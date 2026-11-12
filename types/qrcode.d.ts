declare module "qrcode" {
  const qrcode: {
    toDataURL(text: string, options?: { margin?: number; width?: number }): Promise<string>;
  };
  export default qrcode;
}
