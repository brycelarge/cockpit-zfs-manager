import React, { useState, useEffect } from 'react';
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { EmptyState, EmptyStateBody, EmptyStateFooter, Title } from '@patternfly/react-core';
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { ReplicatorIcon } from '@patternfly/react-icons';

import { ListingTable } from 'cockpit-components-table.jsx';
import { useDialogs } from 'dialogs.jsx';
import { SchedulerApi } from '../../zfsApi/scheduler.js';
import CreateReplicationTaskDialog from './createReplicationTaskDialog.jsx';

function ReplicationTasksTable({ pools }) {
    const Dialogs = useDialogs();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const loadedTasks = await SchedulerApi.listTasks();
            setTasks(loadedTasks);
        } catch (error) {
            console.error('Failed to load replication tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await SchedulerApi.deleteTask(id);
            loadTasks();
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    };

    const parseSyncoidCommand = (cmd) => {
        // Simple parser for display
        // syncoid source target
        const parts = cmd.split(/\s+/).filter(p => !p.startsWith('-')); // filtered flags
        // Usually last two args are source and target
        // This is heuristic
        if (parts.length >= 3) {
            return { source: parts[parts.length - 2], target: parts[parts.length - 1] };
        }
        return { source: '?', target: '?' };
    };

    if (loading) {
        return <Spinner size="lg" />;
    }

    if (tasks.length === 0) {
        return (
            <EmptyState>
                <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)', fontSize: '3rem', color: 'var(--pf-t--global--icon--color--subtle)' }}>
                    <ReplicatorIcon />
                </div>
                <Title headingLevel="h4" size="lg">No Scheduled Replication Tasks</Title>
                <EmptyStateBody>
                    Automate your backups by scheduling regular replication tasks using Syncoid.
                </EmptyStateBody>
                <EmptyStateFooter>
                    <Button variant="primary" onClick={() => Dialogs.show(<CreateReplicationTaskDialog pools={pools} onRefresh={loadTasks} />)}>
                        Create Replication Task
                    </Button>
                </EmptyStateFooter>
            </EmptyState>
        );
    }

    return (
        <>
            <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)', display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={() => Dialogs.show(<CreateReplicationTaskDialog pools={pools} onRefresh={loadTasks} />)}>
                    Create Task
                </Button>
            </div>
            <ListingTable
                aria-label="Replication tasks"
                columns={[
                    { title: "Source", props: { width: 25 } },
                    { title: "Destination", props: { width: 25 } },
                    { title: "Schedule", props: { width: 20 } },
                    { title: "Command", props: { width: 20 } },
                    { title: "", props: { width: 10, "aria-label": "Actions" } },
                ]}
                rows={tasks.map(task => {
                    const { source, target } = parseSyncoidCommand(task.command);
                    return {
                        columns: [
                            { title: source },
                            { title: target },
                            { title: task.schedule },
                            { title: <code style={{ fontSize: 'small' }}>{task.command}</code> },
                            {
                                title: (
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(task.id)}>
                                        Delete
                                    </Button>
                                )
                            },
                        ],
                        key: task.id
                    };
                })}
            />
        </>
    );
}

export default ReplicationTasksTable;
