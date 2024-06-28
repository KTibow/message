import Pbf from "pbf-esm";

type Output = {
  encryptedData: Uint8Array;
};
export default (buffer: Uint8Array): Output => {
  const pbf = new Pbf(buffer);
  return pbf.readFields((tag: number, obj: Record<string, any>) => {
    console.log("messagedata, reading", tag);
    if (tag == 8) obj.encryptedData = pbf.readBytes();
  }, {});
};
