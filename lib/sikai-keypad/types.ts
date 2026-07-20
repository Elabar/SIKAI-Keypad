export type HidReportInfo = {
  reportId?: number;
  items?: Array<{
    usagePage?: number;
    usages?: number[];
    reportSize?: number;
    reportCount?: number;
  }>;
};

export type HidCollectionInfo = {
  usagePage?: number;
  usage?: number;
  type?: number;
  inputReports?: HidReportInfo[];
  outputReports?: HidReportInfo[];
  featureReports?: HidReportInfo[];
  children?: HidCollectionInfo[];
};

export type HidInputReportEvent = Event & {
  reportId: number;
  data: DataView;
};

export type HidDevice = {
  opened: boolean;
  productName: string;
  vendorId: number;
  productId: number;
  collections: HidCollectionInfo[];
  open: () => Promise<void>;
  close: () => Promise<void>;
  sendReport: (reportId: number, data: BufferSource) => Promise<void>;
  addEventListener: (type: "inputreport", listener: (event: HidInputReportEvent) => void) => void;
  removeEventListener: (type: "inputreport", listener: (event: HidInputReportEvent) => void) => void;
};

export type HidNavigator = Navigator & {
  hid?: {
    requestDevice: (options: {
      filters: Array<{
        vendorId: number;
        productId: number;
        usagePage?: number;
        usage?: number;
      }>;
    }) => Promise<HidDevice[]>;
    addEventListener: (type: "disconnect", listener: (event: Event & { device?: HidDevice }) => void) => void;
    removeEventListener: (type: "disconnect", listener: (event: Event & { device?: HidDevice }) => void) => void;
  };
};

export type HardwareInfo = {
  name: string;
  vendorId: string;
  productId: string;
  collections: HidCollectionInfo[];
};

export type FirmwareProfile = {
  keyCount: number;
  addOnCount: number;
  protocol: number;
  raw: string;
};

export type KeyAssignment = {
  modifier: number;
  keyCode: number;
};

export type RgbSelection = {
  color: number;
  mode: number;
};

export type LayerAssignments = {
  assignments: KeyAssignment[];
  packets: string[];
};
