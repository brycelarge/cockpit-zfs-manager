import React, { useState } from 'react';

import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";

import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function ImportPoolDialog({ pools, onRefresh }) {
    const Dialogs = useDialogs();
    const [poolName, setPoolName] = useState('');
    const [error, setError] = useState({});
    const [importing, setImporting] = useState(false);

    const handleImport = async () => {
        setImporting(true);
        try {
            await ZfsApi.importPool(poolName.trim() || null);
            Dialogs.close();
            onRefresh();
        } catch (exc) {
            setError({
                dialogError: 'Failed to import pool',
                dialogErrorDetail: exc.message || String(exc)
            });
            setImporting(false);
        }
    };

    return (
        <Modal position="top" variant="small" isOpen onClose={Dialogs.close}>
            <ModalHeader title="Import Storage Pool" />
            <ModalBody>
                <Form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleImport();
                    }}
                    isHorizontal
                >
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            {...(error.dialogErrorDetail && { dialogErrorDetail: error.dialogErrorDetail })}
                        />
                    )}
                    <FormGroup
                        label="Pool Name"
                        fieldId="import-pool-name"
                        helperText="Leave empty to import all available pools"
                    >
                        <TextInput
                            id="import-pool-name"
                            value={poolName}
                            onChange={(_, value) => setPoolName(value)}
                            placeholder="Optional pool name"
                        />
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    id="import-pool-dialog-confirm"
                    onClick={handleImport}
                    isLoading={importing}
                >
                    Import Pool
                </Button>
                <Button variant="link" onClick={Dialogs.close} isDisabled={importing}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default ImportPoolDialog;

