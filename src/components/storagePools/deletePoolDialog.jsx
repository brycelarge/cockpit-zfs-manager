import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function DeletePoolDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [confirmName, setConfirmName] = useState('');
    const [force, setForce] = useState(false);
    const [error, setError] = useState({});
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirmName !== pool.name) {
            setError({
                dialogError: 'Pool name does not match',
                dialogErrorDetail: 'Please type the pool name exactly to confirm deletion'
            });
            return;
        }

        setDeleting(true);
        try {
            await ZfsApi.destroyPool(pool.name, force);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to delete pool ${pool.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setDeleting(false);
        }
    };

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Delete Pool ${pool.name}`} />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}
                <p>
                    This will permanently delete the pool <strong>{pool.name}</strong> and all its data.
                    This action cannot be undone.
                </p>
                <p>
                    Type <strong>{pool.name}</strong> to confirm:
                </p>
                <input
                    type="text"
                    className="pf-v6-c-form-control"
                    value={confirmName}
                    onChange={(e) => {
                        setConfirmName(e.target.value);
                        if (error.dialogError) {
                            setError({});
                        }
                    }}
                    placeholder={pool.name}
                    style={{ width: '100%', marginBottom: 'var(--pf-t--global--spacer--md)' }}
                />
                <Checkbox
                    id="force-delete-pool"
                    label="Force deletion (unmount filesystems)"
                    isChecked={force}
                    onChange={(_, checked) => setForce(checked)}
                />
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="danger"
                    id="delete-pool-dialog-confirm"
                    onClick={handleDelete}
                    isDisabled={confirmName !== pool.name || deleting}
                    isLoading={deleting}
                >
                    Delete Pool
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={deleting}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default DeletePoolDialog;

