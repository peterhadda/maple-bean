import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync, zstdDecompressSync } from 'node:zlib';

const root = new URL('../assets/characters/', import.meta.url);
const expressions = ['smile', 'happy', 'curious', 'surprised', 'focused', 'laughing', 'listening', 'wink', 'blink.L', 'blink.R'];
const components = { 5120: [1, 'readInt8', 127], 5121: [1, 'readUInt8', 255], 5122: [2, 'readInt16LE', 32767], 5123: [2, 'readUInt16LE', 65535], 5125: [4, 'readUInt32LE', 4294967295], 5126: [4, 'readFloatLE', 1] };
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function glb(filename) {
  const bytes = readFileSync(new URL(filename, root));
  assert.ok(bytes.length >= 20, `${filename}: incomplete GLB`);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${filename}: declared GLB length`);
  let json, binary;
  for (let offset = 12; offset < bytes.length;) {
    assert.ok(offset + 8 <= bytes.length, `${filename}: truncated chunk header`);
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    assert.equal(length % 4, 0, `${filename}: chunk alignment`);
    assert.ok(offset + length <= bytes.length, `${filename}: truncated chunk`);
    if (type === 0x4e4f534a) { assert.equal(json, undefined); json = JSON.parse(bytes.toString('utf8', offset, offset + length)); }
    if (type === 0x004e4942) { assert.equal(binary, undefined); binary = bytes.subarray(offset, offset + length); }
    offset += length;
  }
  assert.ok(json && binary, `${filename}: JSON and binary chunks required`);
  assert.equal(json.buffers.length, 1);
  assert.ok(!json.buffers[0].uri && json.buffers[0].byteLength <= binary.length);
  function view(index) {
    const v = json.bufferViews[index];
    assert.ok(v && v.buffer === 0, `${filename}: embedded buffer view ${index}`);
    const offset = v.byteOffset || 0;
    assert.ok(offset >= 0 && offset + v.byteLength <= binary.length);
    return binary.subarray(offset, offset + v.byteLength);
  }
  function accessor(index) {
    const a = json.accessors[index], component = components[a?.componentType], width = widths[a?.type];
    assert.ok(component && width, `${filename}: accessor ${index}`);
    const [size, method, maximum] = component, values = new Float64Array(a.count * width);
    function read(buffer, offset) { const value = buffer[method](offset); return a.normalized ? Math.max(-1, value / maximum) : value; }
    if (a.bufferView !== undefined) {
      const data = view(a.bufferView), stride = json.bufferViews[a.bufferView].byteStride || size * width, start = a.byteOffset || 0;
      assert.ok(stride >= size * width && start + (a.count - 1) * stride + size * width <= data.length);
      for (let i = 0; i < a.count; i++) for (let j = 0; j < width; j++) values[i * width + j] = read(data, start + i * stride + j * size);
    }
    if (a.sparse) {
      const s = a.sparse, [indexSize, indexMethod] = components[s.indices.componentType], indices = view(s.indices.bufferView), data = view(s.values.bufferView);
      for (let i = 0; i < s.count; i++) {
        const item = indices[indexMethod]((s.indices.byteOffset || 0) + i * indexSize);
        assert.ok(item < a.count);
        for (let j = 0; j < width; j++) values[item * width + j] = read(data, (s.values.byteOffset || 0) + (i * width + j) * size);
      }
    }
    return { ...a, values };
  }
  return { json, view, accessor };
}

function inspect(filename, near) {
  const { json, view, accessor } = glb(filename), names = new Set();
  assert.ok(json.skins?.length, `${filename}: native skeleton required`);
  for (const skin of json.skins) {
    assert.ok(skin.joints.length <= 64 && skin.joints.length > 0, `${filename}: joint budget`);
    assert.equal(new Set(skin.joints).size, skin.joints.length);
  }
  let triangles = 0, draws = 0;
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    const mesh = json.meshes[node.mesh], skin = json.skins[node.skin];
    assert.ok(skin, `${filename}: ${node.name} must use the skeleton`);
    for (const name of mesh.extras?.targetNames || []) names.add(name);
    for (const p of mesh.primitives) {
      assert.equal(p.mode ?? 4, 4, `${filename}: triangular character geometry`);
      assert.ok(json.materials[p.material], `${filename}: assigned character material`);
      const vertices = json.accessors[p.attributes.POSITION].count;
      const count = p.indices === undefined ? vertices : json.accessors[p.indices].count;
      assert.equal(count % 3, 0); triangles += count / 3; draws++;
      assert.equal(p.attributes.WEIGHTS_1, undefined, `${filename}: at most four bone influences`);
      assert.equal(p.attributes.JOINTS_1, undefined, `${filename}: at most four joint indices`);
      const weights = accessor(p.attributes.WEIGHTS_0), joints = accessor(p.attributes.JOINTS_0);
      assert.equal(weights.type, 'VEC4'); assert.equal(joints.type, 'VEC4');
      assert.equal(weights.count, vertices); assert.equal(joints.count, vertices);
      for (let i = 0; i < vertices; i++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          const weight = weights.values[i * 4 + k], joint = joints.values[i * 4 + k];
          assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1, `${filename}: finite skin weight`);
          assert.ok(Number.isInteger(joint) && joint >= 0 && joint < skin.joints.length, `${filename}: valid joint index`);
          sum += weight;
        }
        assert.ok(Math.abs(sum - 1) < 1e-4, `${filename}: vertex ${i} weight sum ${sum}`);
      }
      if (p.targets) assert.equal(p.targets.length, mesh.extras.targetNames.length);
    }
  }
  assert.ok(draws > 0 && draws <= 7, `${filename}: ${draws} material draws, plus the eighth cup draw`);
  assert.ok(triangles > 0 && triangles <= 60000, `${filename}: ${triangles} triangles`);
  if (near) for (const name of expressions) assert.ok(names.has(name), `${filename}: missing ${name} morph`);
  // Neutral is the unmodified mesh; distant LOD intentionally omits face morphs.
  assert.ok(json.images?.length, `${filename}: embedded character atlases`);
  for (const image of json.images) {
    assert.equal(image.mimeType, 'image/png');
    const png = view(image.bufferView);
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    assert.ok(width > 0 && height > 0 && width <= 2048 && height <= 2048, `${filename}: ${image.name} is ${width}x${height}`);
  }
  return { triangles, draws };
}

for (const id of ['maya', 'claire', 'mara', 'jules', 'noah']) test(`${id}: authored character assets meet the runtime budgets`, () => {
  const near = inspect(`${id}.glb`, true), far = inspect(`${id}-lod.glb`, false);
  assert.ok(far.triangles < near.triangles, `${id}: distant mesh must reduce geometry`);
  const file = readFileSync(new URL(`${id}.blend`, root));
  const blend = file.readUInt32LE(0) === 0xfd2fb528 ? zstdDecompressSync(file) : file.readUInt16LE(0) === 0x8b1f ? gunzipSync(file) : file;
  assert.equal(blend.toString('ascii', 0, 7), 'BLENDER', `${id}: editable Blender source`);
});
