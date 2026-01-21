/**
 * RouteService.test.js - Unit tests for RouteService
 * Phase 6: Testing Suite
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RouteService } from '../../public/js/services/RouteService.js';

describe('RouteService', () => {
    let routeService;

    beforeEach(() => {
        // Mock eventBus and logger
        global.eventBus = {
            emit: vi.fn(),
            on: vi.fn()
        };
        
        global.logger = {
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        };

        routeService = new RouteService('http://test-api.com');
    });

    describe('calculateRoute()', () => {
        it('should calculate route between two points', async () => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        routes: [{ legs: [{ duration: 600 }] }]
                    })
                })
            );

            const result = await routeService.calculateRoute(
                { lat: 45.18, lng: 0.72 },
                { lat: 45.19, lng: 0.73 }
            );

            expect(result.routes).toBeDefined();
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('http://test-api.com'),
                expect.any(Object)
            );
        });

        it('should use cache for duplicate requests', async () => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        routes: [{ legs: [{ duration: 600 }] }]
                    })
                })
            );

            const origin = { lat: 45.18, lng: 0.72 };
            const destination = { lat: 45.19, lng: 0.73 };

            await routeService.calculateRoute(origin, destination);
            await routeService.calculateRoute(origin, destination);

            // Should only call fetch once due to caching
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('should handle API errors', async () => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: false,
                    status: 500
                })
            );

            await expect(
                routeService.calculateRoute(
                    { lat: 45.18, lng: 0.72 },
                    { lat: 45.19, lng: 0.73 }
                )
            ).rejects.toThrow();
        });
    });

    describe('cache management', () => {
        it('should expire cache after TTL', async () => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ routes: [] })
                })
            );

            const origin = { lat: 45.18, lng: 0.72 };
            const destination = { lat: 45.19, lng: 0.73 };

            // Set TTL to 100ms
            routeService.cacheTTL = 100;

            await routeService.calculateRoute(origin, destination);
            
            // Wait for cache to expire
            await new Promise(resolve => setTimeout(resolve, 150));
            
            await routeService.calculateRoute(origin, destination);

            // Should call fetch twice (cache expired)
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('should clear cache on demand', async () => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ routes: [] })
                })
            );

            await routeService.calculateRoute(
                { lat: 45.18, lng: 0.72 },
                { lat: 45.19, lng: 0.73 }
            );

            routeService.clearCache();

            await routeService.calculateRoute(
                { lat: 45.18, lng: 0.72 },
                { lat: 45.19, lng: 0.73 }
            );

            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });
});
