import React, { useState, useEffect } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Card, CardBody, CardTitle } from "@patternfly/react-core/dist/esm/components/Card";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { HelpIcon } from '@patternfly/react-icons';

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function SharesTab({ filesystem, onRefresh }) {
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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
        return <Spinner size="lg" aria-label="Loading share configuration" />;
    }

    return (
        <div>
            {error.dialogError && (
                <ModalError
                    dialogError={error.dialogError}
                    {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                />
            )}

            <Card style={{ marginBottom: 'var(--pf-t--global--spacer--lg)' }}>
                <CardTitle>NFS Share</CardTitle>
                <CardBody>
                    <Form>
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

                        <Button
                            variant="primary"
                            onClick={handleSaveNFS}
                            isDisabled={saving}
                            isLoading={saving}
                            style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}
                        >
                            Save NFS Configuration
                        </Button>
                    </Form>
                </CardBody>
            </Card>

            <Card>
                <CardTitle>SMB/CIFS Share</CardTitle>
                <CardBody>
                    <Form>
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

                        <Button
                            variant="primary"
                            onClick={handleSaveSMB}
                            isDisabled={saving}
                            isLoading={saving}
                            style={{ marginTop: 'var(--pf-t--global--spacer--sm)' }}
                        >
                            Save SMB Configuration
                        </Button>
                    </Form>
                </CardBody>
            </Card>

            <Alert variant="info" title="Note" style={{ marginTop: 'var(--pf-t--global--spacer--lg)' }}>
                <p>NFS and SMB sharing require the respective services to be installed and running on the system.</p>
                <p>For NFS: <code>nfs-kernel-server</code> (Debian/Ubuntu) or <code>nfs-utils</code> (Fedora/RHEL)</p>
                <p>For SMB: <code>samba</code> package</p>
            </Alert>
        </div>
    );
}

export default SharesTab;

