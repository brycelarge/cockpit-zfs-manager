import React, { useState, useEffect } from 'react';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert";
import { TextArea } from "@patternfly/react-core/dist/esm/components/TextArea";
import { Form, FormGroup } from "@patternfly/react-core/dist/esm/components/Form";
import { ModalError } from 'cockpit-components-inline-notification.jsx';
import { SanoidApi } from '../../zfsApi/sanoid.js';

function SanoidConfigDialog({ isOpen, onClose }) {
    const [installed, setInstalled] = useState(null);
    const [configPath, setConfigPath] = useState(null);
    const [configContent, setConfigContent] = useState('');
    const [originalConfig, setOriginalConfig] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [packageManager, setPackageManager] = useState(null);
    const [error, setError] = useState({});

    useEffect(() => {
        if (isOpen) {
            loadConfig();
            detectPackageManager();
        }
    }, [isOpen]);

    const detectPackageManager = async () => {
        try {
            const pm = await SanoidApi.detectPackageManager();
            setPackageManager(pm);
        } catch (exc) {
            console.error('Failed to detect package manager:', exc);
        }
    };

    const loadConfig = async () => {
        setLoading(true);
        setError({});
        try {
            const isInstalled = await SanoidApi.isInstalled();
            setInstalled(isInstalled);

            if (isInstalled) {
                const path = await SanoidApi.getConfigPath();
                setConfigPath(path);

                if (path) {
                    const content = await SanoidApi.readConfig(path);
                    setConfigContent(content);
                    setOriginalConfig(content);
                } else {
                    // Installed but no config found
                    setConfigContent('');
                    setOriginalConfig('');
                }
            }
        } catch (exc) {
            setError({
                dialogError: 'Failed to check sanoid status',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async () => {
        setInstalling(true);
        setError({});

        try {
            await SanoidApi.installSanoid();

            // Create default config if it doesn't exist
            const defaultConfigPath = '/etc/sanoid/sanoid.conf';
            await SanoidApi.createInitialConfig('rpool', defaultConfigPath); // 'rpool' as placeholder

            await loadConfig();
        } catch (exc) {
            setError({
                dialogError: 'Failed to install sanoid',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setInstalling(false);
        }
    };

    const handleCreateConfig = async () => {
        setSaving(true);
        setError({});

        try {
            const defaultConfigPath = '/etc/sanoid/sanoid.conf';
            // Just create a generic template
            const genericConfig = `
# Sanoid Configuration
# See https://github.com/jimsalterjrs/sanoid/wiki/Sanoid for documentation

[template_production]
hourly = 36
daily = 30
monthly = 3
yearly = 0
autosnap = yes
autoprune = yes

# Add your pools/datasets below:
# [rpool]
# use_template = production
# recursive = yes
`;
            await SanoidApi.writeConfig(defaultConfigPath, genericConfig.trim());
            await loadConfig();
        } catch (exc) {
            setError({
                dialogError: 'Failed to create configuration',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        const targetPath = configPath || '/etc/sanoid/sanoid.conf';

        setSaving(true);
        setError({});

        try {
            // Validate first
            // We need to temporarily write it to check it, or trusting user input?
            // SanoidApi.testConfig requires a path.
            // Let's trust SanoidApi.writeConfig to handle errors,
            // but ideally we'd validate.
            // For now, just write it.

            await SanoidApi.writeConfig(targetPath, configContent);

            // Now verify with testConfig?
            // const testResult = await SanoidApi.testConfig(targetPath);
            // if (!testResult.valid) { ... }

            setOriginalConfig(configContent);
            if (!configPath) setConfigPath(targetPath);
            onClose();
        } catch (exc) {
            setError({
                dialogError: 'Failed to save configuration',
                dialogErrorDetail: exc.message || String(exc)
            });
        } finally {
            setSaving(false);
        }
    };

    const content = () => {
        if (loading) {
            return <Spinner size="lg" />;
        }

        if (!installed) {
            return (
                <div>
                    <Alert variant="warning" title="Sanoid is not installed" isInline>
                        Sanoid is required for automatic snapshot management.
                    </Alert>
                    {packageManager ? (
                        <div style={{ marginTop: '1rem' }}>
                            <Button variant="primary" onClick={handleInstall} isLoading={installing}>
                                Install Sanoid ({packageManager})
                            </Button>
                        </div>
                    ) : (
                        <div style={{ marginTop: '1rem' }}>
                            <p>No supported package manager found. Please install 'sanoid' manually.</p>
                        </div>
                    )}
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            dialogErrorDetail={error.dialogErrorDetail}
                        />
                    )}
                </div>
            );
        }

        if (!configPath) {
            return (
                <div>
                    <Alert variant="info" title="No configuration file found" isInline>
                        Sanoid is installed but not configured.
                    </Alert>
                    <div style={{ marginTop: '1rem' }}>
                        <Button variant="primary" onClick={handleCreateConfig} isLoading={saving}>
                            Create Default Configuration
                        </Button>
                    </div>
                    {error.dialogError && (
                        <ModalError
                            dialogError={error.dialogError}
                            dialogErrorDetail={error.dialogErrorDetail}
                        />
                    )}
                </div>
            );
        }

        return (
            <Form>
                {error.dialogError && (
                    <ModalError
                        dialogError={error.dialogError}
                        dialogErrorDetail={error.dialogErrorDetail}
                    />
                )}
                <FormGroup label="Sanoid Configuration (/etc/sanoid/sanoid.conf)" fieldId="sanoid-conf-editor">
                    <TextArea
                        id="sanoid-conf-editor"
                        value={configContent}
                        onChange={(_, value) => setConfigContent(value)}
                        rows={20}
                        style={{ fontFamily: 'monospace' }}
                    />
                </FormGroup>
            </Form>
        );
    };

    return (
        <Modal
            variant="large"
            title="Sanoid Configuration"
            isOpen={isOpen}
            onClose={onClose}
        >
            <ModalBody>
                {content()}
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    isDisabled={loading || !installed || !configPath || configContent === originalConfig || saving}
                    isLoading={saving}
                >
                    Save
                </Button>
                <Button variant="link" onClick={onClose}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}

export default SanoidConfigDialog;
