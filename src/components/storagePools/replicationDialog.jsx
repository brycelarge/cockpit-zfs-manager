import React, { useState, useEffect, useRef } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Tabs, Tab, TabTitleText } from "@patternfly/react-core/dist/esm/components/Tabs";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { HelpIcon } from '@patternfly/react-icons';
import { Progress } from "@patternfly/react-core/dist/esm/components/Progress";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function ReplicationDialog({ snapshot, pool, pools = [], onRefresh }) {
    const Dialogs = useDialogs();
    const [activeTab, setActiveTab] = useState(0);
    const [sending, setSending] = useState(false);
    const [receiving, setReceiving] = useState(false);
    const [error, setError] = useState({});
    const [progress, setProgress] = useState(null);
    const [cancelRequested, setCancelRequested] = useState(false);
    const processRef = useRef(null);
    
    // Send tab state
    const [sendDestination, setSendDestination] = useState('');
    const [sendRecursive, setSendRecursive] = useState(false);
    const [sendIncremental, setSendIncremental] = useState(false);
    const [sendFromSnapshot, setSendFromSnapshot] = useState('');
    const [sendProperties, setSendProperties] = useState(false);
    const [sendToPool, setSendToPool] = useState(false);
    const [sendTargetPool, setSendTargetPool] = useState('');
    
    // Receive tab state
    const [receiveSource, setReceiveSource] = useState('');
    const [receivePool, setReceivePool] = useState(pool.name);
    const [receiveForce, setReceiveForce] = useState(false);
    const [receiveDryRun, setReceiveDryRun] = useState(false);
    const [receiveFromPool, setReceiveFromPool] = useState(false);
    const [receiveSourcePool, setReceiveSourcePool] = useState('');
    const [receiveSourceSnapshot, setReceiveSourceSnapshot] = useState('');

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    };

    const formatSpeed = (bytesPerSecond) => {
        return `${formatBytes(bytesPerSecond)}/s`;
    };

    const formatTime = (seconds) => {
        if (!seconds || seconds === 0) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    };

    const handleCancel = () => {
        setCancelRequested(true);
        // Note: Actual cancellation would require process management
        // For now, we'll just mark it as cancelled
        setSending(false);
        setReceiving(false);
        setProgress(null);
    };

    const handleSend = async () => {
        let destination = sendDestination.trim();
        
        if (sendToPool) {
            if (!sendTargetPool.trim()) {
                setError({
                    dialogError: 'Target pool is required',
                    dialogErrorDetail: 'Please select a destination pool'
                });
                return;
            }
            // For pool-to-pool replication, use the target pool name directly
            destination = sendTargetPool;
        } else {
            if (!destination) {
                setError({
                    dialogError: 'Destination is required',
                    dialogErrorDetail: 'Please specify a destination path or SSH target'
                });
                return;
            }
        }

        setSending(true);
        setError({});
        setProgress({ bytes: 0, speed: 0, elapsed: 0, percent: 0 });
        setCancelRequested(false);
        
        try {
            const progressCallback = (progressData) => {
                if (!cancelRequested) {
                    setProgress(progressData);
                }
            };
            
            await ZfsApi.sendSnapshotWithProgress(snapshot.name, destination, {
                recursive: sendRecursive,
                incremental: sendIncremental,
                fromSnapshot: sendFromSnapshot || null,
                properties: sendProperties,
                toPool: sendToPool,
                targetPool: sendTargetPool
            }, progressCallback);
            
            if (!cancelRequested) {
                Dialogs.close();
                onRefresh();
            }
        } catch (exc) {
            if (!cancelRequested) {
                setError({
                    dialogError: 'Failed to send snapshot',
                    dialogErrorDetail: exc.message || String(exc)
                });
            }
            setSending(false);
            setProgress(null);
        }
    };

    const handleReceive = async () => {
        let source = receiveSource.trim();
        
        if (receiveFromPool) {
            if (!receiveSourcePool.trim() || !receiveSourceSnapshot.trim()) {
                setError({
                    dialogError: 'Source pool and snapshot are required',
                    dialogErrorDetail: 'Please select a source pool and snapshot'
                });
                return;
            }
            source = `${receiveSourcePool}/${receiveSourceSnapshot}`;
        } else {
            if (!source) {
                setError({
                    dialogError: 'Source is required',
                    dialogErrorDetail: 'Please specify a source path or SSH target'
                });
                return;
            }
        }
        
        if (!receivePool.trim()) {
            setError({
                dialogError: 'Destination pool is required',
                dialogErrorDetail: 'Please specify the destination pool name'
            });
            return;
        }

        setReceiving(true);
        setError({});
        setProgress({ bytes: 0, speed: 0, elapsed: 0, percent: 0 });
        setCancelRequested(false);
        
        try {
            const progressCallback = (progressData) => {
                if (!cancelRequested) {
                    setProgress(progressData);
                }
            };
            
            await ZfsApi.receiveSnapshotWithProgress(receivePool, source, {
                force: receiveForce,
                dryRun: receiveDryRun,
                fromPool: receiveFromPool,
                sourcePool: receiveSourcePool,
                sourceSnapshot: receiveSourceSnapshot
            }, progressCallback);
            
            if (!cancelRequested) {
                if (!receiveDryRun) {
                    Dialogs.close();
                    onRefresh();
                } else {
                    setError({
                        dialogError: 'Dry run completed',
                        dialogErrorDetail: 'This was a dry run. No changes were made.'
                    });
                }
            }
            setReceiving(false);
            setProgress(null);
        } catch (exc) {
            if (!cancelRequested) {
                setError({
                    dialogError: 'Failed to receive snapshot',
                    dialogErrorDetail: exc.message || String(exc)
                });
            }
            setReceiving(false);
            setProgress(null);
        }
    };

    return (
        <Modal position="top" variant="large" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Replication: ${snapshot.name}`} />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}

                    <Tabs
                        activeKey={activeTab}
                        onSelect={(_, tabIndex) => setActiveTab(tabIndex)}
                    >
                        <Tab eventKey={0} title={<TabTitleText>Send Snapshot</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                                {progress && (sending || receiving) && (
                                    <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                                        <Progress
                                            value={progress.percent || 0}
                                            label={progress.percent ? `${progress.percent.toFixed(1)}%` : 'In progress...'}
                                            measureLocation="outside"
                                        />
                                        <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)' }}>
                                            <div>Transferred: {formatBytes(progress.bytes)}</div>
                                            {progress.speed > 0 && (
                                                <>
                                                    <div>Speed: {formatSpeed(progress.speed)}</div>
                                                    {progress.remaining && (
                                                        <div>ETA: {formatTime(progress.remaining)}</div>
                                                    )}
                                                    <div>Elapsed: {formatTime(progress.elapsed)}</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <FormGroup fieldId="send-to-pool">
                                    <Checkbox
                                        id="send-to-pool"
                                        label="Send to another ZFS pool"
                                        isChecked={sendToPool}
                                        onChange={(_, checked) => {
                                            setSendToPool(checked);
                                            if (!checked) {
                                                setSendTargetPool('');
                                            }
                                        }}
                                    />
                                </FormGroup>

                                {sendToPool ? (
                                    <FormGroup
                                        label="Target Pool"
                                        fieldId="send-target-pool"
                                        isRequired
                                    >
                                        <FormSelect
                                            id="send-target-pool"
                                            value={sendTargetPool}
                                            onChange={(_, value) => setSendTargetPool(value)}
                                        >
                                            <FormSelectOption value="" label="Select a pool..." isDisabled />
                                            {pools && pools.filter(p => p.name !== pool.name).map(p => (
                                                <FormSelectOption key={p.name} value={p.name} label={p.name} />
                                            ))}
                                        </FormSelect>
                                        <FormHelper helperText="Select the destination pool to receive this snapshot" />
                                    </FormGroup>
                                ) : (
                                    <FormGroup
                                        label={
                                            <span>
                                                Destination
                                                <Tooltip content="Local file path (e.g., /backup/pool.bak) or SSH target (e.g., user@host:/backup/pool.bak)">
                                                    <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                        <HelpIcon />
                                                    </span>
                                                </Tooltip>
                                            </span>
                                        }
                                        fieldId="send-destination"
                                        helperText="Local path or SSH target (user@host:/path)"
                                    >
                                        <TextInput
                                            id="send-destination"
                                            value={sendDestination}
                                            onChange={(_, value) => setSendDestination(value)}
                                            placeholder="/backup/pool.bak or user@host:/backup/pool.bak"
                                        />
                                    </FormGroup>
                                )}

                                <FormGroup fieldId="send-recursive">
                                    <Checkbox
                                        id="send-recursive"
                                        label="Recursive (include all child snapshots)"
                                        isChecked={sendRecursive}
                                        onChange={(_, checked) => setSendRecursive(checked)}
                                    />
                                </FormGroup>

                                <FormGroup fieldId="send-incremental">
                                    <Checkbox
                                        id="send-incremental"
                                        label="Incremental (from base snapshot)"
                                        isChecked={sendIncremental}
                                        onChange={(_, checked) => setSendIncremental(checked)}
                                    />
                                </FormGroup>

                                {sendIncremental && (
                                    <FormGroup
                                        label="From Snapshot"
                                        fieldId="send-from-snapshot"
                                        helperText="Base snapshot for incremental send"
                                    >
                                        <TextInput
                                            id="send-from-snapshot"
                                            value={sendFromSnapshot}
                                            onChange={(_, value) => setSendFromSnapshot(value)}
                                            placeholder="pool/dataset@snapshot"
                                        />
                                    </FormGroup>
                                )}

                                <FormGroup fieldId="send-properties">
                                    <Checkbox
                                        id="send-properties"
                                        label="Include properties"
                                        isChecked={sendProperties}
                                        onChange={(_, checked) => setSendProperties(checked)}
                                    />
                                </FormGroup>
                            </div>
                        </Tab>

                        <Tab eventKey={1} title={<TabTitleText>Receive Snapshot</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                                {progress && (sending || receiving) && (
                                    <div style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                                        <Progress
                                            value={progress.percent || 0}
                                            label={progress.percent ? `${progress.percent.toFixed(1)}%` : 'In progress...'}
                                            measureLocation="outside"
                                        />
                                        <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)' }}>
                                            <div>Transferred: {formatBytes(progress.bytes)}</div>
                                            {progress.speed > 0 && (
                                                <>
                                                    <div>Speed: {formatSpeed(progress.speed)}</div>
                                                    {progress.remaining && (
                                                        <div>ETA: {formatTime(progress.remaining)}</div>
                                                    )}
                                                    <div>Elapsed: {formatTime(progress.elapsed)}</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <FormGroup fieldId="receive-from-pool">
                                    <Checkbox
                                        id="receive-from-pool"
                                        label="Receive from another ZFS pool"
                                        isChecked={receiveFromPool}
                                        onChange={(_, checked) => {
                                            setReceiveFromPool(checked);
                                            if (!checked) {
                                                setReceiveSourcePool('');
                                                setReceiveSourceSnapshot('');
                                            }
                                        }}
                                    />
                                </FormGroup>

                                {receiveFromPool ? (
                                    <>
                                        <FormGroup
                                            label="Source Pool"
                                            fieldId="receive-source-pool"
                                            isRequired
                                        >
                                            <FormSelect
                                                id="receive-source-pool"
                                                value={receiveSourcePool}
                                                onChange={(_, value) => {
                                                    setReceiveSourcePool(value);
                                                    setReceiveSourceSnapshot('');
                                                }}
                                            >
                                                <FormSelectOption value="" label="Select a pool..." isDisabled />
                                                {pools && pools.filter(p => p.name !== pool.name).map(p => (
                                                    <FormSelectOption key={p.name} value={p.name} label={p.name} />
                                                ))}
                                            </FormSelect>
                                        </FormGroup>
                                        <FormGroup
                                            label="Source Snapshot"
                                            fieldId="receive-source-snapshot"
                                            isRequired
                                        >
                                            <TextInput
                                                id="receive-source-snapshot"
                                                value={receiveSourceSnapshot}
                                                onChange={(_, value) => setReceiveSourceSnapshot(value)}
                                                placeholder="pool/dataset@snapshot"
                                                disabled={!receiveSourcePool}
                                            />
                                            <FormHelper helperText={`Enter snapshot name from ${receiveSourcePool || 'source pool'}`} />
                                        </FormGroup>
                                    </>
                                ) : (
                                    <FormGroup
                                        label="Source"
                                        fieldId="receive-source"
                                        helperText="Local file path or SSH target (user@host:/path)"
                                    >
                                        <TextInput
                                            id="receive-source"
                                            value={receiveSource}
                                            onChange={(_, value) => setReceiveSource(value)}
                                            placeholder="/backup/pool.bak or user@host:/backup/pool.bak"
                                        />
                                    </FormGroup>
                                )}

                                <FormGroup
                                    label="Destination Pool"
                                    fieldId="receive-pool"
                                    helperText="Pool name where snapshot will be received"
                                    isRequired
                                >
                                    <FormSelect
                                        id="receive-pool"
                                        value={receivePool}
                                        onChange={(_, value) => setReceivePool(value)}
                                    >
                                        {pools && pools.map(p => (
                                            <FormSelectOption key={p.name} value={p.name} label={p.name} />
                                        ))}
                                    </FormSelect>
                                </FormGroup>

                                <FormGroup fieldId="receive-force">
                                    <Checkbox
                                        id="receive-force"
                                        label="Force (rollback if necessary)"
                                        isChecked={receiveForce}
                                        onChange={(_, checked) => setReceiveForce(checked)}
                                    />
                                </FormGroup>

                                <FormGroup fieldId="receive-dry-run">
                                    <Checkbox
                                        id="receive-dry-run"
                                        label="Dry run (test without applying)"
                                        isChecked={receiveDryRun}
                                        onChange={(_, checked) => setReceiveDryRun(checked)}
                                    />
                                </FormGroup>
                            </div>
                        </Tab>
                    </Tabs>
                </Form>
            </ModalBody>
            <ModalFooter>
                {activeTab === 0 ? (
                    <>
                        {(sending || receiving) && progress && (
                            <Button
                                variant="secondary"
                                isDanger
                                onClick={handleCancel}
                                isDisabled={cancelRequested}
                            >
                                Cancel
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            onClick={handleSend}
                            isDisabled={
                                (sendToPool ? !sendTargetPool.trim() : !sendDestination.trim()) || 
                                sending || 
                                cancelRequested
                            }
                            isLoading={sending && !cancelRequested}
                        >
                            Send Snapshot
                        </Button>
                        <Button variant="link" onClick={Dialogs.close} isDisabled={sending || receiving}>
                            Close
                        </Button>
                    </>
                ) : (
                    <>
                        {(sending || receiving) && progress && (
                            <Button
                                variant="secondary"
                                isDanger
                                onClick={handleCancel}
                                isDisabled={cancelRequested}
                            >
                                Cancel
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            onClick={handleReceive}
                            isDisabled={
                                (receiveFromPool ? (!receiveSourcePool.trim() || !receiveSourceSnapshot.trim()) : !receiveSource.trim()) || 
                                !receivePool.trim() || 
                                receiving || 
                                cancelRequested
                            }
                            isLoading={receiving && !cancelRequested}
                        >
                            Receive Snapshot
                        </Button>
                        <Button variant="link" onClick={Dialogs.close} isDisabled={sending || receiving}>
                            Close
                        </Button>
                    </>
                )}
            </ModalFooter>
        </Modal>
    );
}

export default ReplicationDialog;
