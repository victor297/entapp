"use client";
import OperationsNav from "@/components/operations/OperationsNav";
export default function SideBar(props: {isOpen:boolean;toggleSidebar:()=>void}) { return <OperationsNav role="admin" {...props} />; }
