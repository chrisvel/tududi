import { useEffect, useState } from 'react';
import { getFeatureFlags } from '../utils/featureFlags';

// Whether this is a hosted instance (tududi Cloud). Answers no until the flags
// have loaded, which is also the right answer on a self-hosted instance.
export const useHostedMode = (): boolean => {
    const [hosted, setHosted] = useState(false);

    useEffect(() => {
        let active = true;
        getFeatureFlags().then((flags) => {
            if (active) setHosted(flags.hosted === true);
        });
        return () => {
            active = false;
        };
    }, []);

    return hosted;
};
