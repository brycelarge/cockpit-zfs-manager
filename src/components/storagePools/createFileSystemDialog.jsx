import React, { useState } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function CreateFileSystemDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [fsName, setFsName] = useState(`${pool.name}/`);
    const [encrypted, setEncrypted] = useState(false);
    const [passphrase, setPassphrase] = useState('');
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        const validation = {};
        if (!fsName || !fsName.trim() || !fsName.startsWith(`${pool.name}/`)) {
            validation.name = 'File system name must start with pool name';
        }
        if (encrypted && !passphrase) {
            validation.passphrase = 'Passphrase is required for encrypted file systems';
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        setCreating(true);
        try {
            await ZfsApi.createFileSystem(fsName.trim(), encrypted, passphrase || null);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to create file system',
                dialogErrorDetail: exc.message || String(exc)
            });
            setCreating(false);
        }
    };

    return (
        <Modal position="top" variant="medium" isOpen onClose={Dialogs.close}>
            <ModalHeader title="Create File System" />
            <ModalBody>
                <Form isHorizontal>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}
                    <FormGroup
                        label="File System Name"
                        fieldId="fs-name"
                        validated={validationFailed.name ? 'error' : 'default'}
                    >
                        <TextInput
                            id="fs-name"
                            value={fsName}
                            onChange={(_, value) => {
                                setFsName(value);
                                if (validationFailed.name) {
                                    setValidationFailed({ ...validationFailed, name: undefined });
                                }
                            }}
                            validated={validationFailed.name ? 'error' : 'default'}
                            placeholder={`${pool.name}/`}
                        />
                        <FormHelper
                            fieldId="fs-name"
                            helperTextInvalid={validationFailed.name}
                        />
                    </FormGroup>

                    <FormGroup fieldId="fs-encrypted">
                        <Checkbox
                            id="fs-encrypted"
                            label="Encrypted"
                            isChecked={encrypted}
                            onChange={(_, checked) => setEncrypted(checked)}
                        />
                    </FormGroup>

                    {encrypted && (
                        <FormGroup
                            label="Passphrase"
                            fieldId="fs-passphrase"
                            validated={validationFailed.passphrase ? 'error' : 'default'}
                        >
                            <TextInput
                                id="fs-passphrase"
                                type="password"
                                value={passphrase}
                                onChange={(_, value) => {
                                    setPassphrase(value);
                                    if (validationFailed.passphrase) {
                                        setValidationFailed({ ...validationFailed, passphrase: undefined });
                                    }
                                }}
                                validated={validationFailed.passphrase ? 'error' : 'default'}
                            />
                            <FormHelper
                                fieldId="fs-passphrase"
                                helperTextInvalid={validationFailed.passphrase}
                            />
                        </FormGroup>
                    )}
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleCreate}
                    isDisabled={creating}
                    isLoading={creating}
                >
                    Create File System
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={creating}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default CreateFileSystemDialog;

