/**
 * StateManager.test.js - Unit tests for StateManager
 * Phase 6: Testing Suite
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stateManager } from '../../public/js/StateManager.js';

describe('StateManager', () => {
    beforeEach(() => {
        // Reset state
        stateManager.state = {
            ui: {},
            data: {},
            navigation: {},
            user: {}
        };
        stateManager.history = [];
        stateManager.historyIndex = -1;
    });

    describe('get()', () => {
        it('should retrieve entire state when no path provided', () => {
            const state = stateManager.get();
            expect(state).toHaveProperty('ui');
            expect(state).toHaveProperty('data');
        });

        it('should retrieve nested property with dot notation', () => {
            stateManager.set('ui.modal.isOpen', true);
            const isOpen = stateManager.get('ui.modal.isOpen');
            expect(isOpen).toBe(true);
        });

        it('should return undefined for non-existent path', () => {
            const value = stateManager.get('nonexistent.path');
            expect(value).toBeUndefined();
        });
    });

    describe('set()', () => {
        it('should set nested property', () => {
            stateManager.set('data.routes', ['A', 'B', 'C']);
            expect(stateManager.get('data.routes')).toEqual(['A', 'B', 'C']);
        });

        it('should create nested path if not exists', () => {
            stateManager.set('new.nested.property', 'value');
            expect(stateManager.get('new.nested.property')).toBe('value');
        });

        it('should emit STATE_CHANGE event', () => {
            const callback = vi.fn();
            stateManager.eventBus.on('STATE_CHANGE', callback);
            
            stateManager.set('test', 'value');
            
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: 'test',
                    value: 'value'
                })
            );
        });

        it('should add to history', () => {
            stateManager.set('test', 'value1');
            stateManager.set('test', 'value2');
            
            expect(stateManager.history.length).toBe(2);
        });
    });

    describe('undo()', () => {
        it('should restore previous state', () => {
            stateManager.set('counter', 1);
            stateManager.set('counter', 2);
            stateManager.set('counter', 3);
            
            stateManager.undo();
            expect(stateManager.get('counter')).toBe(2);
            
            stateManager.undo();
            expect(stateManager.get('counter')).toBe(1);
        });

        it('should not undo beyond history start', () => {
            stateManager.set('test', 'value');
            stateManager.undo();
            stateManager.undo(); // Should have no effect
            
            expect(stateManager.historyIndex).toBe(0);
        });
    });

    describe('redo()', () => {
        it('should restore next state', () => {
            stateManager.set('counter', 1);
            stateManager.set('counter', 2);
            stateManager.undo();
            
            stateManager.redo();
            expect(stateManager.get('counter')).toBe(2);
        });

        it('should not redo beyond history end', () => {
            stateManager.set('test', 'value');
            stateManager.redo(); // Should have no effect
            
            expect(stateManager.get('test')).toBe('value');
        });
    });

    describe('subscribe()', () => {
        it('should call callback on state changes', () => {
            const callback = vi.fn();
            stateManager.subscribe(callback);
            
            stateManager.set('test', 'value');
            
            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ test: 'value' })
            );
        });

        it('should return unsubscribe function', () => {
            const callback = vi.fn();
            const unsubscribe = stateManager.subscribe(callback);
            
            stateManager.set('test1', 'value1');
            unsubscribe();
            stateManager.set('test2', 'value2');
            
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });
});
