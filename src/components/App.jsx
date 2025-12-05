import React, { useState, useEffect } from 'react';

import { Page, PageSection } from "@patternfly/react-core/dist/esm/components/Page";
import { Tabs, Tab, TabTitleText } from "@patternfly/react-core/dist/esm/components/Tabs";

import { WithDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../zfsApi/index.js';
import StoragePoolsTable from './storagePools/storagePoolsTable.jsx';
import ReplicationTasksTable from './replication/replicationTasksTable.jsx';
import Dashboard from './dashboard.jsx';

function App() {
    const [pools, setPools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        refreshPools();
    }, []);

    const refreshPools = async () => {
        setLoading(true);
        try {
            const poolsData = await ZfsApi.listPools();
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
                <WithDialogs>
                    <Tabs activeKey={activeTab} onSelect={(_, key) => setActiveTab(key)}>
                        <Tab eventKey={0} title={<TabTitleText>Dashboard</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
                                <Dashboard pools={pools} loading={loading} />
                            </div>
                        </Tab>
                        <Tab eventKey={1} title={<TabTitleText>Storage Pools</TabTitleText>}>
                            <StoragePoolsTable
                                pools={pools}
                                loading={loading}
                                onRefresh={refreshPools}
                            />
                        </Tab>
                        <Tab eventKey={2} title={<TabTitleText>Replication</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
                                <ReplicationTasksTable pools={pools} />
                            </div>
                        </Tab>
                    </Tabs>
                </WithDialogs>
            </PageSection>
        </Page>
    );
}

export default App;

