import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function RollbackSnapshotDialog({ snapshot, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [recursive, setRecursive] = useState(false);
    const [error, setError] = useState({});
    const [rollingBack, setRollingBack] = useState(false);

    const handleRollback = async () => {
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
                <p>
                    <strong>WARNING:</strong> This will rollback to snapshot <strong>{snapshot.name}</strong>.
                    All changes since this snapshot will be lost!
                </p>
                <p>
                    This action cannot be undone.
                </p>
                <Checkbox
                    id="recursive-rollback"
                    label="Recursive rollback (rollback all child file systems)"
                    isChecked={recursive}
                    onChange={(_, checked) => setRecursive(checked)}
                />
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="danger"
                    onClick={handleRollback}
                    isDisabled={rollingBack}
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

