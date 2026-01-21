/**
 * services/index.js - Central exports for all API services
 * Provides clean imports for the entire application
 * 
 * Usage in main.js:
 *   import { initializeAPIServices, getAPIServiceFactory } from './services/index.js';
 *   
 *   // On app startup:
 *   const apiFactory = initializeAPIServices(config);
 *   
 *   // In functions:
 *   const factory = getAPIServiceFactory();
 *   const busRoute = await factory.getBusRoute(...);
 */

// Export all service classes
export { RouteService, getRouteService, setRouteService } from './RouteService.js';
export { GeocodeService, getGeocodeService, setGeocodeService } from './GeocodeService.js';
export { AutocompleteService, getAutocompleteService, setAutocompleteService } from './AutocompleteService.js';

// Export factory
export {
    APIServiceFactory,
    initializeAPIServices,
    getAPIServiceFactory,
    getRouteServiceFromFactory,
    getGeocodeServiceFromFactory,
    getAutocompleteServiceFromFactory
} from './APIServiceFactory.js';
