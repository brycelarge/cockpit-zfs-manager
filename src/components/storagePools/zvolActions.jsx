import React from 'react';

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { KebabDropdown } from 'cockpit-components-dropdown.jsx';

import { useDialogs } from 'dialogs.jsx';
import DeleteZvolDialog from './deleteZvolDialog.jsx';
import ZvolPropertiesDialog from './zvolPropertiesDialog.jsx';
import RenameDatasetDialog from './renameDatasetDialog.jsx';

function ZvolActions({ zvol, pool, onRefresh }) {
    const Dialogs = useDialogs();

    const dropdownItems = [
        <DropdownItem
            key={`${zvol.name}-properties`}
            id={`${zvol.name}-properties`}
            onClick={() => Dialogs.show(<ZvolPropertiesDialog zvol={zvol} onRefresh={onRefresh} />)}
        >
            Properties
        </DropdownItem>,
        <DropdownItem
            key={`${zvol.name}-rename`}
            id={`${zvol.name}-rename`}
            onClick={() => Dialogs.show(<RenameDatasetDialog dataset={zvol} pool={pool} onRefresh={onRefresh} />)}
        >
            Rename
        </DropdownItem>,
        <Divider key={`${zvol.name}-separator-1`} />,
        <DropdownItem
            key={`${zvol.name}-delete`}
            id={`${zvol.name}-delete`}
            className="pf-m-danger"
            onClick={() => Dialogs.show(<DeleteZvolDialog zvol={zvol} pool={pool} onRefresh={onRefresh} />)}
        >
            Delete
        </DropdownItem>
    ];

    return (
        <div className="btn-group">
            <KebabDropdown
                toggleButtonId={`${zvol.name}-action-kebab`}
                position="right"
                dropdownItems={dropdownItems}
            />
        </div>
    );
}

export default ZvolActions;

