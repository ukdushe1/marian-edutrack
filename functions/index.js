/** Cloud Functions entry point — export every function module here. */
const whatsapp = require('./src/whatsapp');

exports.sendWhatsAppAlert = whatsapp.sendWhatsAppAlert;
