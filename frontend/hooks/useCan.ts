import { useStore } from '../store/useStore';
import { Capability } from '../entities/Role';

// Whether the signed-in account may do something its role can restrict. This
// only decides what to show: the server refuses the request either way. It
// answers yes until the capabilities have loaded, so nothing flickers away.
export const useCan = (capability: Capability): boolean =>
    useStore((state) => {
        const capabilities = state.userSettingsStore.capabilities;
        return capabilities === null ? true : capabilities[capability] === true;
    });
