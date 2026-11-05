### \---SLAAC

it is a mechanism that allows a device or host to automatically configure its own IPV6 address without leaving a DHCP server, it is a part of network discovery protocol





### Steps of working of SLAAC:-

##### 1\. Generate link local address

link local address is an address that is automatically assign to every network in the    and is used for communication within the same local network.

Host create a link local address by using prefix fe8::/10



##### 2\. Duplicate address detection-

the host will check if the address is already in use, if it finds a duplicate address then it will generate a new address.



##### 3\. Router solicitation---

the host will send request to discover any router available or not.



##### 4\. Router advertisement--

after finding router the router will reply  back with network prefix and default gateway.



##### 5\. Global address formation-

Now the host will combine the network prefix which is coming from R8 and interface ID which would be self created.the interface id is generated to the mac address

