import React, { useState } from 'react';

import {
    Modal, ModalBody, ModalFooter, ModalHeader
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { ExpandableSection } from "@patternfly/react-core/dist/esm/components/ExpandableSection";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";

import { FormHelper } from 'cockpit-components-form-helper.jsx';
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { useDialogs } from 'dialogs.jsx';

import { ZfsApi } from '../../zfsApi/index.js';

function CreateFileSystemDialog({ pool, onRefresh }) {
    const Dialogs = useDialogs();
    const [fsName, setFsName] = useState(`${pool.name}/`);
    const [encrypted, setEncrypted] = useState(false);
    const [passphrase, setPassphrase] = useState('');
    const [compressionExpanded, setCompressionExpanded] = useState(false);
    const [deduplicationExpanded, setDeduplicationExpanded] = useState(false);
    const [advancedExpanded, setAdvancedExpanded] = useState(false);
    const [compressionEnabled, setCompressionEnabled] = useState(false);
    const [compressionType, setCompressionType] = useState('lz4');
    const [deduplicationEnabled, setDeduplicationEnabled] = useState(false);
    const [quota, setQuota] = useState('');
    const [reservation, setReservation] = useState('');
    const [validationFailed, setValidationFailed] = useState({});
    const [error, setError] = useState({});
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        const validation = {};
        const trimmedName = fsName.trim();
        
        if (!trimmedName || !trimmedName.startsWith(`${pool.name}/`)) {
            validation.name = 'File system name must start with pool name';
        } else {
            // Extract the dataset name part (after pool name)
            const datasetPart = trimmedName.substring(pool.name.length + 1);
            if (!datasetPart) {
                validation.name = 'File system name cannot be empty';
            } else if (datasetPart.includes('@')) {
                validation.name = 'File system name cannot contain @ (use snapshot name format)';
            } else if (datasetPart.includes('#')) {
                validation.name = 'File system name cannot contain #';
            } else if (datasetPart.length > 255) {
                validation.name = 'File system name must be 255 characters or less';
            }
        }
        
        if (encrypted && !passphrase.trim()) {
            validation.passphrase = 'Passphrase is required for encrypted file systems';
        } else if (encrypted && passphrase.trim().length < 8) {
            validation.passphrase = 'Passphrase must be at least 8 characters long';
        }

        if (Object.keys(validation).length > 0) {
            setValidationFailed(validation);
            return;
        }

        setCreating(true);
        try {
            // Build properties object
            const properties = {};
            if (compressionEnabled && compressionType) {
                properties.compression = compressionType;
            }
            if (deduplicationEnabled) {
                properties.deduplication = 'on';
            }
            if (quota.trim()) {
                properties.quota = quota.trim();
            }
            if (reservation.trim()) {
                properties.reservation = reservation.trim();
            }

            await ZfsApi.createFileSystem(trimmedName, encrypted, passphrase.trim() || null, properties);
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

                    <ExpandableSection
                        toggleText="Compression"
                        onToggle={(_, isExpanded) => setCompressionExpanded(isExpanded)}
                        isExpanded={compressionExpanded}
                    >
                        <FormGroup fieldId="fs-compression-enabled">
                            <Checkbox
                                id="fs-compression-enabled"
                                label="Enable compression"
                                isChecked={compressionEnabled}
                                onChange={(_, checked) => setCompressionEnabled(checked)}
                            />
                        </FormGroup>
                        {compressionEnabled && (
                            <FormGroup
                                label="Compression Type"
                                fieldId="fs-compression-type"
                            >
                                <FormSelect
                                    id="fs-compression-type"
                                    value={compressionType}
                                    onChange={(_, value) => setCompressionType(value)}
                                >
                                    <FormSelectOption value="lz4" label="lz4 (fast, recommended)" />
                                    <FormSelectOption value="gzip" label="gzip (balanced)" />
                                    <FormSelectOption value="gzip-1" label="gzip-1 (fastest gzip)" />
                                    <FormSelectOption value="gzip-9" label="gzip-9 (best compression)" />
                                    <FormSelectOption value="zle" label="zle (zero-length encoding)" />
                                    <FormSelectOption value="lzjb" label="lzjb (legacy)" />
                                    <FormSelectOption value="zstd" label="zstd (modern, good compression)" />
                                    <FormSelectOption value="zstd-fast" label="zstd-fast (faster zstd)" />
                                </FormSelect>
                            </FormGroup>
                        )}
                    </ExpandableSection>

                    <ExpandableSection
                        toggleText="Deduplication"
                        onToggle={(_, isExpanded) => setDeduplicationExpanded(isExpanded)}
                        isExpanded={deduplicationExpanded}
                    >
                        <FormGroup fieldId="fs-deduplication-enabled">
                            <Checkbox
                                id="fs-deduplication-enabled"
                                label="Enable deduplication"
                                isChecked={deduplicationEnabled}
                                onChange={(_, checked) => setDeduplicationEnabled(checked)}
                            />
                            <div style={{ marginTop: 'var(--pf-t--global--spacer--sm)', fontSize: 'var(--pf-t--global--font--size--sm)', color: 'var(--pf-t--global--text--color--muted)' }}>
                                Deduplication requires significant RAM. Use with caution.
                            </div>
                        </FormGroup>
                    </ExpandableSection>

                    <ExpandableSection
                        toggleText="Advanced"
                        onToggle={(_, isExpanded) => setAdvancedExpanded(isExpanded)}
                        isExpanded={advancedExpanded}
                    >
                        <FormGroup
                            label="Quota"
                            fieldId="fs-quota"
                            helperText="Maximum size limit for this file system (e.g., 10G, 1T)"
                        >
                            <TextInput
                                id="fs-quota"
                                value={quota}
                                onChange={(_, value) => setQuota(value)}
                                placeholder="e.g., 10G, 1T"
                            />
                        </FormGroup>
                        <FormGroup
                            label="Reservation"
                            fieldId="fs-reservation"
                            helperText="Guaranteed space reserved for this file system (e.g., 10G, 1T)"
                        >
                            <TextInput
                                id="fs-reservation"
                                value={reservation}
                                onChange={(_, value) => setReservation(value)}
                                placeholder="e.g., 10G, 1T"
                            />
                        </FormGroup>
                    </ExpandableSection>
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

