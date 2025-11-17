import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function RenamePoolDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [newName, setNewName] = useState(pool.name);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState({});

    const handleRename = async () => {
        setSubmitted(true);

        if (!newName || newName.trim() === '') {
            return;
        }

        if (newName === pool.name) {
            Dialogs.close();
            return;
        }

        try {
            await ZfsApi.renamePool(pool.name, newName.trim());
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: `Failed to rename pool ${pool.name}`,
                dialogErrorDetail: exc.message || String(exc)
            });
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title={`Rename Pool ${pool.name}`} />
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
                    <FormGroup label="New name" fieldId="rename-pool-new-name">
                        <TextInput
                            id="rename-pool-new-name"
                            validated={submitted && !newName ? "error" : "default"}
                            value={newName}
                            onChange={(_, value) => setNewName(value)}
                        />
                        <FormHelper
                            helperTextInvalid={(submitted && !newName) ? "New name must not be empty" : null}
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="rename-pool-dialog-confirm"
                    onClick={handleRename}
                >
                    Save
                </Button>
                <Button variant="link" onClick={Dialogs.close}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default RenamePoolDialog;

