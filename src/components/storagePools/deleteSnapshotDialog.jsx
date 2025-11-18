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
    const [confirmYes, setConfirmYes] = useState('');
    const [force, setForce] = useState(false);
    const [error, setError] = useState({});
    const [deleting, setDeleting] = useState(false);
    const [holds, setHolds] = useState([]);

    React.useEffect(() => {
        loadHolds();
    }, [snapshot.name]);

    const loadHolds = async () => {
        try {
            const snapshotHolds = await ZfsApi.getSnapshotHolds(snapshot.name);
            setHolds(snapshotHolds);
        } catch {
            setHolds([]);
        }
    };

    const hasHolds = holds.length > 0;

    const handleDelete = async () => {
        if (hasHolds) {
            setError({
                dialogError: 'Cannot delete snapshot with holds',
                dialogErrorDetail: `This snapshot has ${holds.length} hold(s): ${holds.map(h => h.tag).join(', ')}. Release all holds before deleting.`
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
                
                {hasHolds ? (
                    <Alert variant="danger" title="Cannot Delete: Snapshot Has Holds" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                        <p>
                            This snapshot cannot be deleted because it has active holds:
                        </p>
                        <ul style={{ marginTop: 'var(--pf-t--global--spacer--sm)', marginBottom: 0 }}>
                            {holds.map(hold => (
                                <li key={hold.tag}>
                                    <strong>{hold.tag}</strong>
                                    {hold.timestamp && ` (${hold.timestamp})`}
                                </li>
                            ))}
                        </ul>
                        <p style={{ marginTop: 'var(--pf-t--global--spacer--sm)', marginBottom: 0 }}>
                            Release all holds before deleting this snapshot.
                        </p>
                    </Alert>
                ) : (
                    <>
                        <Alert variant="warning" title="Warning: Data Loss Risk" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                            <p>
                                This will permanently delete the snapshot <strong>{snapshot.name}</strong>.
                                This action cannot be undone.
                            </p>
                        </Alert>

                        <p>
                            Type <strong>"yes"</strong> to confirm deletion:
                        </p>
                    </>
                )}
                {!hasHolds && (
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
                )}

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
                    variant="secondary"
                    isDanger
                    onClick={handleDelete}
                    isDisabled={
                        hasHolds ||
                        !confirmYes || 
                        confirmYes.trim().toLowerCase() !== 'yes' || 
                        deleting
                    }
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

