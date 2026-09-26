export const environment = {
  production: true,
  apiUrl: 'https://api.vetonspot.com/api/v1',
  appMode: 'customer',
  firebase: {
    apiKey: 'AIzaSyBQ8aFNqwsqb_ReDMv1J7M9pUQNFq8_Cew',
    authDomain: 'vetonspot.firebaseapp.com',
    projectId: 'vetonspot',
    storageBucket: 'vetonspot.firebasestorage.app',
    messagingSenderId: '714139403655',
    appId: '1:714139403655:web:4ea130a32e4fefbcf27f22',
    measurementId: 'G-KXBYN0KNJD',
  },
  msg91: {
    widgetId: '36696c676a43333736353632',
    /** Client Side Integration → Select Token */
    tokenAuth: '570388T8ekXxOq6aa4fc51P1',
    /**
     * MSG91 retry channel (custom widget config).
     * SMS: '11' | Voice: '4' | Email: '3' | WhatsApp: '12'
     * Use null only if the widget uses MSG91 default configuration.
     */
    retryChannel: '11',
  },
};
