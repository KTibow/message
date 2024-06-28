import Pbf from "pbf-esm";

type AuthMessageData = {
  requestId: string;
  network: string;
  configVersion: ConfigVersionData;
};
type ConfigVersionData = {
  year: number;
  month: number;
  day: number;
  v1: number;
  v2: number;
};
type BrowserDetailsData = {
  userAgent: string;
  browserType: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  os: string;
  deviceType: 0 | 1 | 2 | 3;
};
type DataData = { ecdsaKeys: ECDSAKeysData };
type ECDSAKeysData = { key: Uint8Array };

export default (obj: { data: DataData }): Uint8Array => {
  const pbf = new Pbf();
  pbf.writeMessage(1, AuthMessage, {
    requestId: crypto.randomUUID(),
    network: "Bugle",
    configVersion: { year: 2024, month: 5, day: 9, v1: 4, v2: 6 },
  });
  pbf.writeMessage(3, BrowserDetails, {
    userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`,
    browserType: 2,
    os: "Linux",
    deviceType: 1,
  });
  pbf.writeMessage(4, Data, obj.data);
  return pbf.finish();
};

const AuthMessage = (obj: AuthMessageData, pbf: Pbf) => {
  pbf.writeStringField(1, obj.requestId);
  pbf.writeStringField(3, obj.network);
  pbf.writeMessage(7, ConfigVersion, obj.configVersion);
};
const ConfigVersion = (obj: ConfigVersionData, pbf: Pbf) => {
  pbf.writeVarintField(3, obj.year);
  pbf.writeVarintField(4, obj.month);
  pbf.writeVarintField(5, obj.day);
  pbf.writeVarintField(7, obj.v1);
  pbf.writeVarintField(9, obj.v2);
};

const BrowserDetails = (obj: BrowserDetailsData, pbf: Pbf) => {
  pbf.writeStringField(1, obj.userAgent);
  pbf.writeVarintField(2, obj.browserType);
  pbf.writeStringField(3, obj.os);
  pbf.writeVarintField(6, obj.deviceType);
};

const Data = (obj: DataData, pbf: Pbf) => {
  pbf.writeMessage(6, ECDSAKeys, obj.ecdsaKeys);
};
const ECDSAKeys = (obj: ECDSAKeysData, pbf: Pbf) => {
  pbf.writeVarintField(1, 2);
  pbf.writeBytesField(2, obj.key);
};
