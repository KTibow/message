import Pbf from "pbf-esm";

type Output = {
  pairingKey: Uint8Array;
  authKey: {
    key: Uint8Array;
    TTL: number;
  };
};
export default (buffer: Uint8Array): Output => {
  const pbf = new Pbf(buffer);
  return pbf.readFields((tag: number, obj: Record<string, any>) => {
    if (tag == 3) {
      obj.pairingKey = pbf.readBytes();
    }
    if (tag == 5) {
      obj.authKey = pbf.readFields(
        (tag: number, obj: Record<string, any>) => {
          if (tag == 1) obj.key = pbf.readBytes();
          if (tag == 2) obj.TTL = pbf.readVarint64();
        },
        {},
        pbf.readVarint() + pbf.pos
      );
    }
  }, {});
};
