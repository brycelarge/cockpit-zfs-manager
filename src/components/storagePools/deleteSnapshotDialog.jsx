import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function DeleteSnapshotDialog({ snapshot, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [confirmName, setConfirmName] = useState('');
    const [confirmYes, setConfirmYes] = useState('');
    const [force, setForce] = useState(false);
    const [error, setError] = useState({});
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirmName.trim() !== snapshot.name) {
            setError({
                dialogError: 'Snapshot name does not match',
                dialogErrorDetail: 'Please type the snapshot name exactly to confirm deletion'
            });
            return;
        }

        if (confirmYes.trim().toLowerCase() !== 'yes') {
            setError({
                dialogError: 'Confirmation required',
                dialogErrorDetail: 'Please type "yes" to confirm deletion'
            });
            return;
        }

        setDeleting(true);
        try {
            await ZfsApi.destroySnapshot(snapshot.name, force);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to delete snapshot ${snapshot.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setDeleting(false);
        }
    };

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Delete Snapshot ${snapshot.name}`} />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}
                
                <Alert variant="warning" title="Warning: Data Loss Risk" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>
                        This will permanently delete the snapshot <strong>{snapshot.name}</strong>.
                        This action cannot be undone.
                    </p>
                </Alert>

                <p>
                    Type <strong>{snapshot.name}</strong> to confirm:
                </p>
                <TextInput
                    id="confirm-snapshot-name"
                    value={confirmName}
                    onChange={(_, value) => {
                        setConfirmName(value);
                        if (error.dialogError) {
                            setError({});
                        }
                    }}
                    placeholder={snapshot.name}
                    validated={confirmName && confirmName !== snapshot.name ? 'error' : 'default'}
                    style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
                />

                <p>
                    Type <strong>"yes"</strong> to confirm deletion:
                </p>
                <TextInput
                    id="confirm-yes"
                    value={confirmYes}
                    onChange={(_, value) => {
                        setConfirmYes(value);
                        if (error.dialogError) {
                            setError({});
                        }
                    }}
                    placeholder="yes"
                    validated={confirmYes && confirmYes.toLowerCase() !== 'yes' ? 'error' : 'default'}
                    style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
                />

                <Checkbox
                    id="force-delete-snapshot"
                    label="Force deletion (destroy even if snapshot has clones)"
                    isChecked={force}
                    onChange={(_, checked) => setForce(checked)}
                />
                <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                    Use this if the snapshot has clones and you want to destroy it anyway.
                </p>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="danger"
                    onClick={handleDelete}
                    isDisabled={confirmName.trim() !== snapshot.name || confirmYes.trim().toLowerCase() !== 'yes' || deleting}
                    isLoading={deleting}
                >
                    Delete Snapshot
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={deleting}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default DeleteSnapshotDialog;

