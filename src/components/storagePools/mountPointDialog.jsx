import React, { useState, useEffect } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { HelpIcon } from '@patternfly/react-icons';

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';
import { ZfsApi } from '../../zfsApi/index.js';

function MountPointDialog({ filesystem, onRefresh }) {
    const Dialogs = useDialogs();
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [mountpoint, setMountpoint] = useState('');
    const [mountOptions, setMountOptions] = useState('');
    const [mounting, setMounting] = useState(false);
    const [unmounting, setUnmounting] = useState(false);
    const [error, setError] = useState({});

    useEffect(() => {
        loadMountStatus();
    }, [filesystem.name]);

    const loadMountStatus = async () => {
        setLoading(true);
        try {
            const isMounted = await ZfsApi.getMountStatus(filesystem.name);
            setMounted(isMounted);
            
            // Get mountpoint property
            const props = await ZfsApi.getDatasetProperties(filesystem.name);
            setMountpoint(props.mountpoint?.value || 'default');
        } catch (exc) {
            setError({
                dialogError: 'Failed to load mount status',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleMount = async () => {
        setMounting(true);
        setError({});
        try {
            await ZfsApi.mountDataset(filesystem.name, {
                options: mountOptions.trim() || undefined
            });
            await loadMountStatus();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to mount dataset',
                dialogErrorDetail: exc.message || String(exc)
            });
            setMounting(false);
        }
    };

    const handleUnmount = async () => {
        setUnmounting(true);
        setError({});
        try {
            await ZfsApi.unmountDataset(filesystem.name, {
                force: false
            });
            await loadMountStatus();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to unmount dataset',
                dialogErrorDetail: exc.message || String(exc)
            });
            setUnmounting(false);
        }
    };

    const handleUpdateMountpoint = async () => {
        setMounting(true);
        setError({});
        try {
            await ZfsApi.setDatasetProperty(filesystem.name, 'mountpoint', mountpoint);
            await loadMountStatus();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to update mountpoint',
                dialogErrorDetail: exc.message || String(exc)
            });
            setMounting(false);
        }
    };

    if (loading) {
        return (
            <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
                <ModalHeader title={`Mount Point: ${filesystem.name}`} />
                <ModalBody>
                    <Spinner size="lg" aria-label="Loading mount status" />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Mount Point: ${filesystem.name}`} />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}

                    <Alert
                        variant={mounted ? 'success' : 'warning'}
                        title={mounted ? 'Dataset is mounted' : 'Dataset is not mounted'}
                        style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
                    />

                    <FormGroup
                        label={
                            <span>
                                Mount Point
                                <Tooltip content="Directory where the dataset will be mounted. Use 'none' to prevent mounting, 'legacy' for manual mounting.">
                                    <span style={{ marginLeft: 'var(--pf-t--global--spacer--xs)' }}>
                                        <HelpIcon />
                                    </span>
                                </Tooltip>
                            </span>
                        }
                        fieldId="mountpoint"
                        helperText="Use 'default', 'none', 'legacy', or a custom path"
                    >
                        <TextInput
                            id="mountpoint"
                            value={mountpoint}
                            onChange={(_, value) => setMountpoint(value)}
                            placeholder="default"
                        />
                    </FormGroup>

                    <FormGroup
                        label="Mount Options"
                        fieldId="mount-options"
                        helperText="Additional mount options (e.g., noatime,nosuid)"
                    >
                        <TextInput
                            id="mount-options"
                            value={mountOptions}
                            onChange={(_, value) => setMountOptions(value)}
                            placeholder="noatime,nosuid"
                        />
                    </FormGroup>

                    <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', marginTop: 'var(--pf-t--global--spacer--md)' }}>
                        {mounted ? (
                            <Button
                                variant="danger"
                                onClick={handleUnmount}
                                isDisabled={unmounting}
                                isLoading={unmounting}
                            >
                                Unmount
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={handleMount}
                                isDisabled={mounting}
                                isLoading={mounting}
                            >
                                Mount
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            onClick={handleUpdateMountpoint}
                            isDisabled={mounting || unmounting}
                            isLoading={mounting}
                        >
                            Update Mount Point
                        </Button>
                    </div>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="link" onClick={Dialogs.close} isDisabled={mounting || unmounting}>
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default MountPointDialog;

