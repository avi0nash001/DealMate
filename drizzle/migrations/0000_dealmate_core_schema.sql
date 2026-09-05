-- Enums
CREATE TYPE public.session_stage AS ENUM ('preference','hunter','negotiation','closed');
CREATE TYPE public.order_status AS ENUM ('placed','confirmed');

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price > 0),
  tags text[] NOT NULL DEFAULT '{}',
  stock_count integer NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products readable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "products editable by authenticated" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products insertable by authenticated" ON public.products FOR INSERT TO authenticated WITH CHECK (true);

-- Live offers
CREATE TABLE public.live_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_pct numeric(5,2) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 50),
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_offers TO authenticated;
GRANT ALL ON public.live_offers TO service_role;
ALTER TABLE public.live_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers readable by everyone" ON public.live_offers FOR SELECT USING (true);
CREATE POLICY "offers writable by authenticated" ON public.live_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Negotiation sessions
CREATE TABLE public.negotiation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  category text,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  preferences text[] NOT NULL DEFAULT '{}',
  stage public.session_stage NOT NULL DEFAULT 'preference',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  final_price numeric(10,2),
  matched_product_ids uuid[] NOT NULL DEFAULT '{}',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negotiation_sessions TO authenticated;
GRANT ALL ON public.negotiation_sessions TO service_role;
ALTER TABLE public.negotiation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.negotiation_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  session_id uuid REFERENCES public.negotiation_sessions(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  negotiated_price numeric(10,2) NOT NULL CHECK (negotiated_price > 0),
  delivery_address text NOT NULL,
  status public.order_status NOT NULL DEFAULT 'placed',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Atomic order placement
CREATE OR REPLACE FUNCTION public.place_order(
  _product_id uuid,
  _quantity integer,
  _negotiated_price numeric,
  _delivery_address text,
  _session_id uuid DEFAULT NULL
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _stock integer;
  _order public.orders;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 10 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  IF _delivery_address IS NULL OR length(trim(_delivery_address)) < 8 THEN RAISE EXCEPTION 'Delivery address required'; END IF;

  SELECT stock_count INTO _stock FROM public.products WHERE id = _product_id FOR UPDATE;
  IF _stock IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF _stock < _quantity THEN RAISE EXCEPTION 'Insufficient stock'; END IF;

  UPDATE public.products SET stock_count = stock_count - _quantity WHERE id = _product_id;

  INSERT INTO public.orders (user_id, product_id, session_id, quantity, negotiated_price, delivery_address, status)
  VALUES (_uid, _product_id, _session_id, _quantity, _negotiated_price, trim(_delivery_address), 'confirmed')
  RETURNING * INTO _order;

  RETURN _order;
END;
$$;
REVOKE ALL ON FUNCTION public.place_order(uuid,integer,numeric,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(uuid,integer,numeric,text,uuid) TO authenticated, service_role;

-- Realtime
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.live_offers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_offers;

-- Seed products
INSERT INTO public.products (name, category, price, tags, stock_count) VALUES
('Strider Pace 4 Running Shoes', 'running shoes', 6499.00, ARRAY['lightweight','daily trainer','breathable','road'], 24),
('TrailGrip Ultra GTX', 'running shoes', 11999.00, ARRAY['trail','waterproof','grippy','durable'], 12),
('CloudFoam Marathon Elite', 'running shoes', 15499.00, ARRAY['max cushioning','marathon','carbon plate','race day'], 8),
('Zephyr Lite 2', 'running shoes', 3999.00, ARRAY['budget','lightweight','beginner','road'], 40),
('StablePath Support 9', 'running shoes', 8999.00, ARRAY['stability','flat feet','cushioned','daily trainer'], 15),
('PulseBuds Air Pro', 'earbuds', 9999.00, ARRAY['anc','long battery','premium sound','bluetooth 5.3'], 30),
('EchoFit Sport Buds', 'earbuds', 4499.00, ARRAY['sweatproof','gym','secure fit','bass'], 45),
('NanoSound Mini', 'earbuds', 2299.00, ARRAY['budget','compact','calls','lightweight'], 60),
('StudioMonitor TWS 500', 'earbuds', 13999.00, ARRAY['audiophile','hi-res','anc','low latency'], 10);

-- Seed live offers
INSERT INTO public.live_offers (product_id, discount_pct, expires_at, active)
SELECT id, 12.00, now() + interval '2 hours', true FROM public.products WHERE name = 'PulseBuds Air Pro';
INSERT INTO public.live_offers (product_id, discount_pct, expires_at, active)
SELECT id, 8.00, now() + interval '45 minutes', true FROM public.products WHERE name = 'Strider Pace 4 Running Shoes';
INSERT INTO public.live_offers (product_id, discount_pct, expires_at, active)
SELECT id, 15.00, now() + interval '30 minutes', true FROM public.products WHERE name = 'TrailGrip Ultra GTX';