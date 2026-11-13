export const environment = {
  production: false,
  // TODO: set to your local .NET admin API base URL (e.g. https://localhost:7001/api)
  // Separate Delivery Management site (same as .NET appsettings DeliveryManagementUI).
  deliveryManagementUrl: 'https://devdelivery.uvanij.com/',
  apiUrl: 'https://ecommapigateway.gobiens.com/Gateway',
  // Multipart image upload endpoint (relative to apiUrl). TODO: confirm exact path.
  uploadPath: 'ProductManagement/UploadImage',
};
