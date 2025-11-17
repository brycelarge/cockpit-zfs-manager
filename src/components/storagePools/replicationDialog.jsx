import React, { useState } from 'react';

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

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function ReplicationDialog({ snapshot, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [activeTab, setActiveTab] = useState(0);
    const [sending, setSending] = useState(false);
    const [receiving, setReceiving] = useState(false);
    const [error, setError] = useState({});
    
    // Send tab state
    const [sendDestination, setSendDestination] = useState('');
    const [sendRecursive, setSendRecursive] = useState(false);
    const [sendIncremental, setSendIncremental] = useState(false);
    const [sendFromSnapshot, setSendFromSnapshot] = useState('');
    const [sendProperties, setSendProperties] = useState(false);
    
    // Receive tab state
    const [receiveSource, setReceiveSource] = useState('');
    const [receivePool, setReceivePool] = useState(pool.name);
    const [receiveForce, setReceiveForce] = useState(false);
    const [receiveDryRun, setReceiveDryRun] = useState(false);

    const handleSend = async () => {
        if (!sendDestination.trim()) {
            setError({
                dialogError: 'Destination is required',
                dialogErrorDetail: 'Please specify a destination path or SSH target'
            });
            return;
        }

        setSending(true);
        setError({});
        try {
            await ZfsApi.sendSnapshot(snapshot.name, sendDestination, {
                recursive: sendRecursive,
                incremental: sendIncremental,
                fromSnapshot: sendFromSnapshot || null,
                properties: sendProperties
            });
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to send snapshot',
                dialogErrorDetail: exc.message || String(exc)
            });
            setSending(false);
        }
    };

    const handleReceive = async () => {
        if (!receiveSource.trim()) {
            setError({
                dialogError: 'Source is required',
                dialogErrorDetail: 'Please specify a source path or SSH target'
            });
            return;
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
        try {
            await ZfsApi.receiveSnapshot(receivePool, receiveSource, {
                force: receiveForce,
                dryRun: receiveDryRun
            });
            if (!receiveDryRun) {
                Dialogs.close();
                onRefresh();
            } else {
                setError({
                    dialogError: 'Dry run completed',
                    dialogErrorDetail: 'This was a dry run. No changes were made.'
                });
            }
            setReceiving(false);
        } catch (exc) {
            setError({
                dialogError: 'Failed to receive snapshot',
                dialogErrorDetail: exc.message || String(exc)
            });
            setReceiving(false);
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

                                <FormGroup
                                    label="Destination Pool"
                                    fieldId="receive-pool"
                                    helperText="Pool name where snapshot will be received"
                                >
                                    <TextInput
                                        id="receive-pool"
                                        value={receivePool}
                                        onChange={(_, value) => setReceivePool(value)}
                                        placeholder={pool.name}
                                    />
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
                        <Button
                            variant="primary"
                            onClick={handleSend}
                            isDisabled={!sendDestination.trim() || sending}
                            isLoading={sending}
                        >
                            Send Snapshot
                        </Button>
                        <Button variant="link" onClick={Dialogs.close} isDisabled={sending}>
                            Cancel
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="primary"
                            onClick={handleReceive}
                            isDisabled={!receiveSource.trim() || !receivePool.trim() || receiving}
                            isLoading={receiving}
                        >
                            Receive Snapshot
                        </Button>
                        <Button variant="link" onClick={Dialogs.close} isDisabled={receiving}>
                            Cancel
                        </Button>
                    </>
                )}
            </ModalFooter>
        </Modal>
    );
}

export default ReplicationDialog;

