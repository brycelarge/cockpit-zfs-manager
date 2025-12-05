import React, { useState } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';
import ReplicationDialog from './replicationDialog.jsx';

function ReplicateFileSystemDialog({ pool, filesystem, pools, onRefresh }) {
    const Dialogs = useDialogs();
    const baseName = filesystem ? filesystem.name : pool.name;

    // Generate default snapshot name: manual-YYYYMMDD-HHMM
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') + '-' +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0');
    const defaultSnapName = `manual-${timestamp}`;

    const [name, setName] = useState(defaultSnapName);
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});
    const [creating, setCreating] = useState(false);

    const handleCreateAndContinue = async () => {
        const validation = {};
        const trimmedName = name.trim();

        if (!trimmedName) {
            validation.name = 'Snapshot name is required';
        } else {
            // Snapshot names cannot contain @ or #
            if (trimmedName.includes('@')) {
                validation.name = 'Snapshot name cannot contain @';
            } else if (trimmedName.includes('#')) {
                validation.name = 'Snapshot name cannot contain #';
            } else if (trimmedName.length > 255) {
                validation.name = 'Snapshot name must be 255 characters or less';
            }
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        const fullName = `${baseName}@${trimmedName}`;
        setCreating(true);
        try {
            await ZfsApi.createSnapshot(fullName);
            onRefresh(); // Refresh parent list

            // Create snapshot object structure expected by ReplicationDialog
            const snapshotObj = {
                name: fullName,
                // These properties might not be strictly needed for send,
                // but good to have a valid-looking object
                used: '0B',
                referenced: '0B',
                creation: 'Just now'
            };

            // Close current dialog first to avoid conflict
            Dialogs.close();

            // Open Replication Dialog after a brief delay to ensure previous one is fully closed
            setTimeout(() => {
                Dialogs.show(
                    <ReplicationDialog
                        snapshot={snapshotObj}
                        pool={pool}
                        pools={pools}
                        onRefresh={onRefresh}
                    />
                );
            }, 100);
        } catch (exc) {
            setError({
                dialogError: 'Failed to create snapshot',
                dialogErrorDetail: exc.message || String(exc)
            });
            setCreating(false);
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title="Replicate Filesystem" />
            <ModalBody>
                <p style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    First, create a snapshot of <strong>{baseName}</strong> to replicate.
                </p>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}
                    <FormGroup
                        label="Snapshot Name"
                        fieldId="snapshot-name"
                        validated={validationFailed.name ? 'error' : 'default'}
                        helperText={`Full name: ${baseName}@[name]`}
                    >
                        <TextInput
                            id="snapshot-name"
                            value={name}
                            onChange={(_, value) => {
                                setName(value);
                                if (validationFailed.name) {
                                    setValidationFailed({ ...validationFailed, name: undefined });
                                }
                            }}
                            validated={validationFailed.name ? 'error' : 'default'}
                            placeholder="snapshot-name"
                        />
                        <FormHelper
                            fieldId="snapshot-name"
                            helperTextInvalid={validationFailed.name}
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleCreateAndContinue}
                    isDisabled={creating}
                    isLoading={creating}
                >
                    Next: Configure Replication
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={creating}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ReplicateFileSystemDialog;
