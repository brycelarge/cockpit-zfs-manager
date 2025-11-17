import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function RollbackSnapshotDialog({ snapshot, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [recursive, setRecursive] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState({});
    const [rollingBack, setRollingBack] = useState(false);

    const handleRollback = async () => {
        if (confirmText.toLowerCase() !== 'yes') {
            setError({
                dialogError: 'Confirmation required',
                dialogErrorDetail: 'Please type "yes" to confirm rollback'
            });
            return;
        }

        setRollingBack(true);
        try {
            await ZfsApi.rollbackSnapshot(snapshot.name, recursive);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to rollback to snapshot ${snapshot.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setRollingBack(false);
        }
    };

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Rollback to Snapshot ${snapshot.name}`} />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}
                
                <Alert variant="warning" title="Warning: Data Loss Risk" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>
                        <strong>WARNING:</strong> This will rollback to snapshot <strong>{snapshot.name}</strong>.
                        All changes since this snapshot will be permanently lost!
                    </p>
                    <p>
                        This action cannot be undone.
                    </p>
                </Alert>

                <Checkbox
                    id="recursive-rollback"
                    label="Recursive rollback (rollback all child file systems)"
                    isChecked={recursive}
                    onChange={(_, checked) => setRecursive(checked)}
                    style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
                />

                <div>
                    <p>
                        Type <strong>"yes"</strong> to confirm rollback:
                    </p>
                    <TextInput
                        id="confirm-rollback"
                        value={confirmText}
                        onChange={(_, value) => {
                            setConfirmText(value);
                            if (error.dialogError) {
                                setError({});
                            }
                        }}
                        placeholder="yes"
                        validated={confirmText && confirmText.toLowerCase() !== 'yes' ? 'error' : 'default'}
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="danger"
                    onClick={handleRollback}
                    isDisabled={confirmText.toLowerCase() !== 'yes' || rollingBack}
                    isLoading={rollingBack}
                >
                    Rollback
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={rollingBack}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default RollbackSnapshotDialog;

