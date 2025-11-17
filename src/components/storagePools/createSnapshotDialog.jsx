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

function CreateSnapshotDialog({ pool, filesystem = null, onRefresh }) {
    const Dialogs = useDialogs();
    const snapshotName = filesystem ? `${filesystem.name}@` : `${pool.name}@`;
    const [name, setName] = useState('');
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        const validation = {};
        if (!name || !name.trim()) {
            validation.name = 'Snapshot name is required';
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        const fullName = filesystem ? `${filesystem.name}@${name.trim()}` : `${pool.name}@${name.trim()}`;
        setCreating(true);
        try {
            await ZfsApi.createSnapshot(fullName);
            Dialogs.close();
            onRefresh();
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
            <ModalHeader title="Create Snapshot" />
            <ModalBody>
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
                        helperText={`Full name will be: ${snapshotName}[name]`}
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
                    onClick={handleCreate}
                    isDisabled={creating}
                    isLoading={creating}
                >
                    Create Snapshot
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={creating}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default CreateSnapshotDialog;

