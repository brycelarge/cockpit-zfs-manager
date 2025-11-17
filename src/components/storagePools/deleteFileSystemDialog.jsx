import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function DeleteFileSystemDialog({ filesystem, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [confirmName, setConfirmName] = useState('');
    const [force, setForce] = useState(false);
    const [error, setError] = useState({});
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirmName !== filesystem.name) {
            setError({
                dialogError: 'File system name does not match',
                dialogErrorDetail: 'Please type the file system name exactly to confirm deletion'
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
                <p>
                    This will permanently delete the file system <strong>{filesystem.name}</strong> and all its data.
                    This action cannot be undone.
                </p>
                <p>
                    Type <strong>{filesystem.name}</strong> to confirm:
                </p>
                <TextInput
                    id="confirm-filesystem-name"
                    value={confirmName}
                    onChange={(_, value) => {
                        setConfirmName(value);
                        if (error.dialogError) {
                            setError({});
                        }
                    }}
                    placeholder={filesystem.name}
                    validated={confirmName && confirmName !== filesystem.name ? 'error' : 'default'}
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
                    variant="danger"
                    onClick={handleDelete}
                    isDisabled={confirmName !== filesystem.name || deleting}
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

