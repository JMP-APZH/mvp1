-- Update Category Names (Use '&' for brevity)
update categories 
set name = 'Bébé & Petite Enfance',
    icon = '👶🏾' -- 👶 becomes 👶🏾 (Brown/Black baby)
where name = 'Bébé et Petite Enfance' or name = 'Bébé & Petite Enfance';

update categories 
set name = 'Poissons & Fruits de Mer' 
where name = 'Poissons et Fruits de Mer' or name = 'Poissons & Fruits de Mer';

-- Verify update
select * from categories where icon = '👶🏾';
