export interface VitaConfig {
  readonly xLogin: string;
  readonly xApiKey: string;
  readonly secretKey: string;
  readonly baseURL: string;
  readonly walletUuid: string;
  readonly port: number;
}

const config: VitaConfig = {
  xLogin: '96d9d97670845298cfe2ef1555d17ceed9689233',
  xApiKey: '0ncrcAxg1hov3e6qjAkx4KkdCA8=',
  secretKey: '77dfd00ab170340b2f739d39bf23a812006eb16c9aa54226e2d40e3e60a9587a7921446f5fcddaa2314b09610d2a91f2f216b9078861b38162531b83f8d8d0001c49008f3ac7f240f1086c7ff5cd47b351909fc8d17a68a6e4bbb1b96223b8b5be15961bfb3f83f75360add366dcf499cdfaf18f801d58860175316652d6c5033ddd8c8296dbef8b9ed8475f9aca4e337d74c4d14c93c5dd4bedcf2bb12a7ac3181be038ae31b1a7fbce86fe1d70d668115a42d5721032df54adb91a1f997c39e68d2cef4bb9bf8476f6f0bfea07a4734b38e89422bd35d0890e3030a25c8ae08da1214364e64ea7a74b1a417a6ddacdbdb7e6d652c87b543763e5e0a00f048076b2300d2a2e85b0ce699e30f505b2ec31ad9a56a6916e33c5352f0138f08feb76ff583e71144247637fd0f5',
  baseURL: 'https://api.stage.vitawallet.io/api/businesses',
  walletUuid: '04ba61ea-0e39-40c4-98e1-5c61497db91e',
  port: 3000,
};

export default config;

