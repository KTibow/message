import type Pbf from "pbf-esm";

type Output = {
  userId: number;
  sourceId: string;
  network: string;
};
export default (pbf: Pbf, end: number): Output => {
  return pbf.readFields(
    (tag: number, obj: Record<string, any>) => {
      if (tag == 1) obj.userId = pbf.readVarint();
      if (tag == 2) obj.sourceId = pbf.readString();
      if (tag == 3) obj.network = pbf.readString();
    },
    {},
    end
  );
};
