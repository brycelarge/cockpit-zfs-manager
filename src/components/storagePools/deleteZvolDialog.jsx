import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function DeleteZvolDialog({ zvol, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [confirmName, setConfirmName] = useState('');
    const [confirmYes, setConfirmYes] = useState('');
    const [error, setError] = useState({});
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirmName !== zvol.name) {
            setError({
                dialogError: 'Name mismatch',
                dialogErrorDetail: 'Please enter the exact ZVOL name to confirm deletion'
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
            await ZfsApi.destroyZvol(zvol.name);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to delete ZVOL ${zvol.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setDeleting(false);
        }
    };

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Delete ZVOL ${zvol.name}`} />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}
                
                <Alert variant="warning" title="Warning: Data Loss Risk" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>
                        This will permanently delete the ZVOL volume <strong>{zvol.name}</strong>.
                        This action cannot be undone and will destroy all data in the volume.
                    </p>
                </Alert>

                <p>
                    Type the ZVOL name <strong>{zvol.name}</strong> to confirm:
                </p>
                <TextInput
                    id="confirm-name"
                    value={confirmName}
                    onChange={(_, value) => {
                        setConfirmName(value);
                        if (error.dialogError) {
                            setError({});
                        }
                    }}
                    placeholder={zvol.name}
                    validated={confirmName && confirmName !== zvol.name ? 'error' : 'default'}
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
                />
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="secondary"
                    isDanger
                    onClick={handleDelete}
                    isDisabled={
                        confirmName !== zvol.name || 
                        !confirmYes || 
                        confirmYes.trim().toLowerCase() !== 'yes' || 
                        deleting
                    }
                    isLoading={deleting}
                >
                    Delete ZVOL
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={deleting}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default DeleteZvolDialog;

