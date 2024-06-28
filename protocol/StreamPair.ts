import Pbf from "pbf-esm";
import Device from "./_Device";

type Output = {
  paired: Paired;
};
type Paired = {
  mobile: { userId: number; sourceId: string; network: string };
  authKey: { key: Uint8Array; TTL: number };
  browser: { userId: number; sourceId: string; network: string };
};
export default (buffer: Uint8Array): Output => {
  const pbf = new Pbf(buffer);
  return pbf.readFields((tag: number, obj: Record<string, any>) => {
    if (tag == 4) {
      obj.paired = paired(pbf, pbf.readVarint() + pbf.pos);
    }
  }, {});
};

const paired = (pbf: Pbf, end: number): Paired => {
  return pbf.readFields(
    (tag: number, obj: Record<string, any>) => {
      if (tag == 1) obj.mobile = Device(pbf, pbf.readVarint() + pbf.pos);
      if (tag == 2)
        obj.authKey = pbf.readFields(
          (tag: number, obj: Record<string, any>) => {
            if (tag == 1) obj.key = pbf.readBytes();
            if (tag == 2) obj.TTL = pbf.readVarint64();
          },
          {},
          pbf.readVarint() + pbf.pos
        );
      if (tag == 3) obj.browser = Device(pbf, pbf.readVarint() + pbf.pos);
    },
    {},
    end
  );
};
