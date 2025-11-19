import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function RenameDatasetDialog({ dataset, pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [newName, setNewName] = useState(dataset.name);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState({});
    const [renaming, setRenaming] = useState(false);

    // Extract the dataset part (after pool name)
    const getDatasetPart = (fullName) => {
        if (fullName.startsWith(`${pool.name}/`)) {
            return fullName.substring(pool.name.length + 1);
        }
        return fullName;
    };

    const datasetPart = getDatasetPart(dataset.name);
    const suggestedNewName = `${pool.name}/${getDatasetPart(newName)}`;

    const handleRename = async () => {
        setSubmitted(true);

        if (!newName || newName.trim() === '') {
            setError({
                dialogError: 'Name is required',
                dialogErrorDetail: 'Please enter a new name for the dataset'
            });
            return;
        }

        const trimmedName = newName.trim();

        // Validate the new name
        if (!trimmedName.startsWith(`${pool.name}/`)) {
            setError({
                dialogError: 'Invalid name format',
                dialogErrorDetail: `Dataset name must start with pool name: ${pool.name}/`
            });
            return;
        }

        // Extract dataset part and validate
        const newDatasetPart = getDatasetPart(trimmedName);
        if (!newDatasetPart) {
            setError({
                dialogError: 'Invalid name',
                dialogErrorDetail: 'Dataset name cannot be empty'
            });
            return;
        }

        if (newDatasetPart.includes('@')) {
            setError({
                dialogError: 'Invalid name',
                dialogErrorDetail: 'Dataset name cannot contain @ (reserved for snapshots)'
            });
            return;
        }

        if (newDatasetPart.includes('#')) {
            setError({
                dialogError: 'Invalid name',
                dialogErrorDetail: 'Dataset name cannot contain # (reserved for bookmarks)'
            });
            return;
        }

        if (trimmedName === dataset.name) {
            Dialogs.close();
            return;
        }

        setRenaming(true);
        setError({});
        try {
            await ZfsApi.renameDataset(dataset.name, trimmedName);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to rename dataset ${dataset.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
            setRenaming(false);
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Rename Dataset ${dataset.name}`} />
            <ModalBody>
                <Form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleRename();
                    }}
                    isHorizontal
                >
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}

                    <Alert variant="info" title="About Renaming" style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
                        <p>
                            Renaming a dataset will update its mount point automatically. Child datasets and snapshots will be renamed recursively.
                        </p>
                    </Alert>

                    <FormGroup label="Current Name" fieldId="current-name">
                        <TextInput
                            id="current-name"
                            value={dataset.name}
                            isReadOnly
                            style={{ backgroundColor: 'var(--pf-t--global--palette--black-150)' }}
                        />
                    </FormGroup>

                    <FormGroup label="New Name" fieldId="rename-dataset-new-name" isRequired>
                        <TextInput
                            id="rename-dataset-new-name"
                            validated={submitted && !newName ? "error" : "default"}
                            value={newName}
                            onChange={(_, value) => {
                                setNewName(value);
                                if (error.dialogError) {
                                    setError({});
                                }
                            }}
                            placeholder={`${pool.name}/`}
                        />
                        <FormHelper
                            helperText={`Full name will be: ${suggestedNewName}`}
                            helperTextInvalid={(submitted && !newName) ? "New name must not be empty" : null}
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="rename-dataset-dialog-confirm"
                    onClick={handleRename}
                    isDisabled={renaming}
                    isLoading={renaming}
                >
                    Rename
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={renaming}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default RenameDatasetDialog;

