import React from 'react';

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown";
import { KebabDropdown } from 'cockpit-components-dropdown.jsx';

import { useDialogs } from 'dialogs.jsx';
import RenamePoolDialog from './renamePoolDialog.jsx';
import DeletePoolDialog from './deletePoolDialog.jsx';

function PoolActions({ pool, onRefresh }) {
    const Dialogs = useDialogs();

    const dropdownItems = [
        <DropdownItem
            key={`${pool.name}-rename`}
            id={`${pool.name}-rename`}
            onClick={() => Dialogs.show(<RenamePoolDialog pool={pool} onRefresh={onRefresh} />)}
        >
            Rename Pool
        </DropdownItem>,
        <Divider key={`${pool.name}-separator`} />,
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

