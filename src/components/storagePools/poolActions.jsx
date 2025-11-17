import React from 'react';

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { KebabDropdown } from 'cockpit-components-dropdown.jsx';

import { useDialogs } from 'dialogs.jsx';
import RenamePoolDialog from './renamePoolDialog.jsx';
import ExportPoolDialog from './exportPoolDialog.jsx';
import DeletePoolDialog from './deletePoolDialog.jsx';
import PoolPropertiesDialog from './poolPropertiesDialog.jsx';
import ExpandPoolDialog from './expandPoolDialog.jsx';
import ReplaceDiskDialog from './replaceDiskDialog.jsx';

function PoolActions({ pool, onRefresh }) {
    const Dialogs = useDialogs();

    const dropdownItems = [
        <DropdownItem
            key={`${pool.name}-properties`}
            id={`${pool.name}-properties`}
            onClick={() => Dialogs.show(<PoolPropertiesDialog pool={pool} onRefresh={onRefresh} />)}
        >
            Properties
        </DropdownItem>,
        <DropdownItem
            key={`${pool.name}-expand`}
            id={`${pool.name}-expand`}
            onClick={() => Dialogs.show(<ExpandPoolDialog pool={pool} onRefresh={onRefresh} />)}
        >
            Expand Pool
        </DropdownItem>,
        <DropdownItem
            key={`${pool.name}-replace-disk`}
            id={`${pool.name}-replace-disk`}
            onClick={() => Dialogs.show(<ReplaceDiskDialog pool={pool} onRefresh={onRefresh} />)}
        >
            Replace Disk
        </DropdownItem>,
        <Divider key={`${pool.name}-separator-1`} />,
        <DropdownItem
            key={`${pool.name}-rename`}
            id={`${pool.name}-rename`}
            onClick={() => Dialogs.show(<RenamePoolDialog pool={pool} onRefresh={onRefresh} />)}
        >
            Rename Pool
        </DropdownItem>,
        <DropdownItem
            key={`${pool.name}-export`}
            id={`${pool.name}-export`}
            onClick={() => Dialogs.show(<ExportPoolDialog pool={pool} onRefresh={onRefresh} />)}
        >
            Export Pool
        </DropdownItem>,
        <Divider key={`${pool.name}-separator-2`} />,
        <DropdownItem
            key={`${pool.name}-delete`}
            id={`${pool.name}-delete`}
            className="pf-m-danger"
            onClick={() => Dialogs.show(<DeletePoolDialog pool={pool} onRefresh={onRefresh} />)}
        >
            Delete Pool
        </DropdownItem>
    ];

    return (
        <div className="btn-group">
            <KebabDropdown
                toggleButtonId={`${pool.name}-action-kebab`}
                position="right"
                dropdownItems={dropdownItems}
            />
        </div>
    );
}

export default PoolActions;

