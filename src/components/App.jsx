import React, { useState, useEffect } from 'react';

import { Page, PageSection } from "@patternfly/react-core/dist/esm/components/Page";

import { loadPools } from '../actions/pools.js';
import StoragePoolsTable from './storagePools/storagePoolsTable.jsx';

function App() {
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        refreshPools();
    }, []);

    const refreshPools = async () => {
        setLoading(true);
        try {
            const poolsData = await loadPools();
            setPools(poolsData);
        } catch (error) {
            console.error('Failed to load pools:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Page className="pf-m-no-sidebar">
            <PageSection hasBodyWrapper={false}>
                <StoragePoolsTable
                    pools={pools}
                    loading={loading}
                    onRefresh={refreshPools}
                />
            </PageSection>
        </Page>
    );
}

export default App;

