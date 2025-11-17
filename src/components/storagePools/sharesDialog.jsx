import React, { useState, useEffect } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Tabs, Tab, TabTitleText } from "@patternfly/react-core/dist/esm/components/Tabs";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { HelpIcon } from '@patternfly/react-icons';

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function SharesDialog({ filesystem, onRefresh }) {
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [shares, setShares] = useState({ nfs: null, smb: null });
    const [nfsEnabled, setNfsEnabled] = useState(false);
    const [nfsOptions, setNfsOptions] = useState('');
    const [smbEnabled, setSmbEnabled] = useState(false);
    const [smbName, setSmbName] = useState('');
    const [error, setError] = useState({});

    useEffect(() => {
        loadShares();
    }, [filesystem.name]);

    const loadShares = async () => {
        setLoading(true);
        try {
            const shareInfo = await ZfsApi.listShares(filesystem.name);
            setShares(shareInfo);
            setNfsEnabled(shareInfo.nfs !== null && shareInfo.nfs !== 'off');
            setNfsOptions(shareInfo.nfs && shareInfo.nfs !== 'on' ? shareInfo.nfs : '');
            setSmbEnabled(shareInfo.smb !== null && shareInfo.smb !== 'off');
            if (shareInfo.smb && shareInfo.smb.startsWith('name=')) {
                setSmbName(shareInfo.smb.replace('name=', ''));
            }
        } catch (exc) {
            setError({
                dialogError: 'Failed to load share configuration',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveNFS = async () => {
        setSaving(true);
        setError({});
        try {
            if (nfsEnabled) {
                await ZfsApi.configureNFSShare(filesystem.name, {
                    options: nfsOptions.trim() || undefined
                });
            } else {
                await ZfsApi.setDatasetProperty(filesystem.name, 'sharenfs', 'off');
            }
            await loadShares();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to configure NFS share',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSMB = async () => {
        setSaving(true);
        setError({});
        try {
            if (smbEnabled) {
                await ZfsApi.configureSMBShare(filesystem.name, {
                    name: smbName.trim() || undefined
                });
            } else {
                await ZfsApi.setDatasetProperty(filesystem.name, 'sharesmb', 'off');
            }
            await loadShares();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to configure SMB share',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Modal position="top" variant="large" isOpen onClose={Dialogs.close}>
                <ModalHeader title={`Shares: ${filesystem.name}`} />
                <ModalBody>
                    <Spinner size="lg" aria-label="Loading share configuration" />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <Modal position="top" variant="large" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Shares: ${filesystem.name}`} />
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
                        <Tab eventKey={0} title={<TabTitleText>NFS Share</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                                <FormGroup fieldId="nfs-enabled">
                                    <Checkbox
                                        id="nfs-enabled"
                                        label="Enable NFS sharing"
                                        isChecked={nfsEnabled}
                                        onChange={(_, checked) => {
                                            setNfsEnabled(checked);
                                            if (!checked) {
                                                setNfsOptions('');
                                            }
                                        }}
                                    />
                                </FormGroup>

                                {nfsEnabled && (
                                    <FormGroup
                                        label={
                                            <span>
                                                NFS Options
                                                <Tooltip content="NFS share options (e.g., ro, rw=192.168.1.0/24, sync)">
                                                    <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                                        <HelpIcon />
                                                    </span>
                                                </Tooltip>
                                            </span>
                                        }
                                        fieldId="nfs-options"
                                        helperText="Leave empty for default (rw). Examples: ro, rw=192.168.1.0/24, sync"
                                    >
                                        <TextInput
                                            id="nfs-options"
                                            value={nfsOptions}
                                            onChange={(_, value) => setNfsOptions(value)}
                                            placeholder="rw"
                                        />
                                    </FormGroup>
                                )}
                            </div>
                        </Tab>

                        <Tab eventKey={1} title={<TabTitleText>SMB/CIFS Share</TabTitleText>}>
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                                <FormGroup fieldId="smb-enabled">
                                    <Checkbox
                                        id="smb-enabled"
                                        label="Enable SMB/CIFS sharing"
                                        isChecked={smbEnabled}
                                        onChange={(_, checked) => {
                                            setSmbEnabled(checked);
                                            if (!checked) {
                                                setSmbName('');
                                            }
                                        }}
                                    />
                                </FormGroup>

                                {smbEnabled && (
                                    <FormGroup
                                        label="Share Name"
                                        fieldId="smb-name"
                                        helperText="Optional custom share name. Leave empty to use dataset name."
                                    >
                                        <TextInput
                                            id="smb-name"
                                            value={smbName}
                                            onChange={(_, value) => setSmbName(value)}
                                            placeholder={filesystem.name.split('/').pop()}
                                        />
                                    </FormGroup>
                                )}
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
                            onClick={handleSaveNFS}
                            isDisabled={saving}
                            isLoading={saving}
                        >
                            Save NFS Configuration
                        </Button>
                        <Button variant="link" onClick={Dialogs.close} isDisabled={saving}>
                            Close
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="primary"
                            onClick={handleSaveSMB}
                            isDisabled={saving}
                            isLoading={saving}
                        >
                            Save SMB Configuration
                        </Button>
                        <Button variant="link" onClick={Dialogs.close} isDisabled={saving}>
                            Close
                        </Button>
                    </>
                )}
            </ModalFooter>
        </Modal>
    );
}

export default SharesDialog;

