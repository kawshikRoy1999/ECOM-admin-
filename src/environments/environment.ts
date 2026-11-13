export const environment = {
  production: true,
  // TODO: set to your production .NET admin API base URL
  // Separate Delivery Management site (same as .NET appsettings DeliveryManagementUI).
  deliveryManagementUrl: 'https://devdelivery.uvanij.com/',
  apiUrl: 'https://ecommapigateway.gobiens.com/Gateway',
  // Multipart image upload endpoint (relative to apiUrl). TODO: confirm exact path.
  uploadPath: 'ProductManagement/UploadImage',
};
