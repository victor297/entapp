"use client";
import OperationsNav from "@/components/operations/OperationsNav";
export default function ServiceProviderSideBar(props: {isOpen:boolean;toggleSidebar:()=>void}) { return <OperationsNav role="provider" {...props} />; }
