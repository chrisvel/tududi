import React, { useState, useEffect, useMemo } from 'react';
import { Location } from 'react-router-dom';
import {
    UserGroupIcon,
    ChevronRightIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import { Person } from '../../entities/Person';
import { useStore } from '../../store/useStore';

interface SidebarPeopleProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    openPersonModal: (person: Person | null) => void;
}

const getPersonPath = (person: Person) => `/person/${person.uid}`;

const SidebarPeople: React.FC<SidebarPeopleProps> = ({
    handleNavClick,
    location,
    openPersonModal,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const people = useStore((state) => state.peopleStore.people);
    const hasLoaded = useStore((state) => state.peopleStore.hasLoaded);
    const loadPeople = useStore((state) => state.peopleStore.loadPeople);

    useEffect(() => {
        if (!hasLoaded) {
            loadPeople();
        }
    }, [hasLoaded, loadPeople]);

    const sortedPeople = useMemo(
        () => [...people].sort((a, b) => a.name.localeCompare(b.name)),
        [people]
    );

    useEffect(() => {
        if (sortedPeople.some((person) => getPersonPath(person) === location.pathname)) {
            setIsExpanded(true);
        }
    }, [location.pathname, sortedPeople.length]);

    const isPeoplePageActive =
        location.pathname === '/people' || location.pathname.startsWith('/person/');

    const isActive = (path: string) => location.pathname === path;

    const itemClass = (path: string) =>
        `group flex justify-between items-center rounded-[8px] pl-[30px] pr-[10px] py-[4px] text-[13.5px] cursor-pointer text-gray-500 dark:text-[oklch(82%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive(path) ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)]' : ''
        }`;

    const navigate = (person: Person) =>
        handleNavClick(
            getPersonPath(person),
            person.name,
            <UserGroupIcon className="h-4 w-4 mr-2" />
        );

    return (
        <ul className="flex flex-col">
            <li
                className={`group flex justify-between items-center px-[10px] py-[4px] rounded-md hover:bg-gray-100 dark:hover:bg-white/5 ${
                    isPeoplePageActive ? 'bg-gray-100 dark:bg-white/5' : ''
                }`}
            >
                <span
                    className={`flex items-center gap-[6px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        isPeoplePageActive
                            ? 'text-black dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                    onClick={() => {
                        setIsExpanded(true);
                        handleNavClick(
                            '/people',
                            'People',
                            <UserGroupIcon className="h-4 w-4 mr-2" />
                        );
                    }}
                >
                    <UserGroupIcon className="h-[14px] w-[14px]" />
                    People
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openPersonModal(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label="Add Person"
                        title="Add Person"
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                    {sortedPeople.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded((v) => !v);
                            }}
                            className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        >
                            <ChevronRightIcon
                                className="h-3 w-3 transition-transform duration-150"
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                            />
                        </button>
                    )}
                </div>
            </li>

            {isExpanded && (
                <li className="p-0 list-none">
                    <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5 mb-1.5">
                        {sortedPeople.map((person) => (
                            <div
                                key={person.uid}
                                className={itemClass(getPersonPath(person))}
                                onClick={() => navigate(person)}
                            >
                                <span className="truncate min-w-0">
                                    {person.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </li>
            )}
        </ul>
    );
};

export default SidebarPeople;
