/**
 * EventBus.test.js - Unit tests for EventBus
 * Phase 6: Testing Suite
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus, EVENTS } from '../../public/js/EventBus.js';

describe('EventBus', () => {
    beforeEach(() => {
        // Clear all listeners before each test
        eventBus.events.clear();
    });

    describe('on()', () => {
        it('should register event listener', () => {
            const callback = vi.fn();
            eventBus.on(EVENTS.STATE_CHANGE, callback);
            
            expect(eventBus.listenerCount(EVENTS.STATE_CHANGE)).toBe(1);
        });

        it('should support multiple listeners for same event', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            eventBus.on(EVENTS.STATE_CHANGE, callback1);
            eventBus.on(EVENTS.STATE_CHANGE, callback2);
            
            const listeners = eventBus.events.get(EVENTS.STATE_CHANGE);
            expect(listeners).toHaveLength(2);
        });
    });

    describe('emit()', () => {
        it('should call all registered listeners', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const data = { test: 'data' };
            
            eventBus.on(EVENTS.STATE_CHANGE, callback1);
            eventBus.on(EVENTS.STATE_CHANGE, callback2);
            eventBus.emit(EVENTS.STATE_CHANGE, data);
            
            expect(callback1).toHaveBeenCalledWith(data);
            expect(callback2).toHaveBeenCalledWith(data);
        });

        it('should handle errors in listeners gracefully', () => {
            const errorCallback = vi.fn(() => { throw new Error('Test error'); });
            const normalCallback = vi.fn();
            
            eventBus.on(EVENTS.STATE_CHANGE, errorCallback);
            eventBus.on(EVENTS.STATE_CHANGE, normalCallback);
            
            expect(() => eventBus.emit(EVENTS.STATE_CHANGE, {})).not.toThrow();
            expect(normalCallback).toHaveBeenCalled();
        });
    });

    describe('off()', () => {
        it('should remove specific listener', () => {
            const callback = vi.fn();
            
            eventBus.on(EVENTS.STATE_CHANGE, callback);
            eventBus.off(EVENTS.STATE_CHANGE, callback);
            eventBus.emit(EVENTS.STATE_CHANGE, {});
            
            expect(callback).not.toHaveBeenCalled();
        });

        it('should only remove specified listener', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            
            eventBus.on(EVENTS.STATE_CHANGE, callback1);
            eventBus.on(EVENTS.STATE_CHANGE, callback2);
            eventBus.off(EVENTS.STATE_CHANGE, callback1);
            eventBus.emit(EVENTS.STATE_CHANGE, {});
            
            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });
    });

    describe('once()', () => {
        it('should call listener only once', () => {
            const callback = vi.fn();
            
            eventBus.once(EVENTS.STATE_CHANGE, callback);
            eventBus.emit(EVENTS.STATE_CHANGE, {});
            eventBus.emit(EVENTS.STATE_CHANGE, {});
            
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('EVENTS constants', () => {
        it('should have all required events defined', () => {
            const requiredEvents = [
                'STATE_CHANGE',
                'ROUTE_SELECTED',
                'MAP_READY',
                'SEARCH_START',
                'API_REQUEST',
                'API_SUCCESS',
                'API_ERROR'
            ];
            
            requiredEvents.forEach(event => {
                expect(EVENTS[event]).toBeDefined();
                expect(typeof EVENTS[event]).toBe('string');
            });
        });
    });
});
