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

function DeleteFileSystemDialog({ filesystem, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [confirmYes, setConfirmYes] = useState('');
    const [force, setForce] = useState(false);
    const [error, setError] = useState({});
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirmYes.toLowerCase() !== 'yes') {
            setError({
                dialogError: 'Confirmation required',
                dialogErrorDetail: 'Please type "yes" to confirm deletion'
            });
            return;
        }

        setDeleting(true);
        try {
            await ZfsApi.destroyFileSystem(filesystem.name, force);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to delete file system ${filesystem.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setDeleting(false);
        }
    };

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Delete File System ${filesystem.name}`} />
            <ModalBody>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                    />
                )}

                <Alert variant="warning" title="Warning: Data Loss Risk" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                    <p>
                        This will permanently delete the file system <strong>{filesystem.name}</strong> and all its data.
                        This action cannot be undone.
                    </p>
                </Alert>

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
                    id="force-delete-fs"
                    label="Force deletion (recursive, destroy children)"
                    isChecked={force}
                    onChange={(_, checked) => setForce(checked)}
                />
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="secondary"
                    isDanger
                    onClick={handleDelete}
                    isDisabled={confirmYes.toLowerCase() !== 'yes' || deleting}
                    isLoading={deleting}
                >
                    Delete File System
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={deleting}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default DeleteFileSystemDialog;

